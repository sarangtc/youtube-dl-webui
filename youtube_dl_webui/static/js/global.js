var videoDownload = (function (Vue, extendAM){
    var videoDownload = {};
    var VueToast = window.vueToasts ? window.vueToasts.default || window.vueToasts : window.vueToasts;
    videoDownload.vm = null;
    videoDownload.tasksData = {
        headPath: window.location.protocol + '//' + window.location.host + '/',
        videoList: [],
        showModal: false,
        modalType: 'addTask',
        tablist: ['Status', 'Details', 'Log'],
        showTab: 'Status',
        stateCounter: { all: 0, downloading: 0, finished: 0, paused: 0, invalid: 0},
        // populated from the server's 'format_options' config (see
        // loadServerConfig) so presets are configurable without a redeploy
        formatOptions: [],
        aboutCustomHtml: '',
        modalData: {
            add: { url: '', ydl_opts: { format: '' } },
            preference: {
                youtube_dl: { format: '', proxy: '', ratelimit: '', outtmpl: '' },
                general: { download_dir: '', db_path: '', log_size: '', max_concurrent: '', about_custom_html: '' }
            },
        },
        // selectedTids is the multi-selection the toolbar acts on;
        // selectedTid is the focused row shown in the details pane and
        // anchorTid is where a shift-click range starts from
        selectedTids: [],
        selectedTid: null,
        anchorTid: null,
        taskDetails: {},
        contextMenu: { visible: false, x: 0, y: 0 },
        ydl: { installed: '', latest: '', updateAvailable: false, checking: false, updating: false },
        status: 'all',
        fetchFailures: 0,
        maxToasts: 4,
        position: 'bottom right',
        timeLife: 3500,
        closeBtn: false
    };

    videoDownload.createVm = function(res) {
        var that = videoDownload;
        that.vm = new Vue({
            el: '#videoWrapper',
            data: that.tasksData,
            components:{
                'modal': {template: '#modal-template'},
                VueToast
            },
            computed: {
                selectedTask: function() {
                    var tid = this.selectedTid;
                    if (tid === null) return null;
                    for (var i = 0; i < this.videoList.length; i++) {
                        if (this.videoList[i].tid === tid) return this.videoList[i];
                    }
                    return null;
                },
                selectedTasks: function() {
                    var tids = this.selectedTids;
                    return this.videoList.filter(function(v) {
                        return tids.indexOf(v.tid) !== -1;
                    });
                },
                hasSelection: function() {
                    return this.selectedTasks.length > 0;
                },
                allSelected: function() {
                    return this.videoList.length > 0 && this.selectedTasks.length === this.videoList.length;
                },
                someSelected: function() {
                    return this.hasSelection && !this.allSelected;
                },
                finishedSelection: function() {
                    return this.selectedTasks.filter(function(v) { return v.state === 'finished'; });
                },
                canDownload: function() {
                    return this.finishedSelection.length > 0;
                }
            },
            mounted: function () {
                this.resetOptions();
                setInterval(videoDownload.timeOut, 3000);
                this.loadServerConfig(true);

                // clicking/scrolling anywhere outside the context menu closes it
                var _self = this;
                document.addEventListener('click', function(){ _self.closeContextMenu(); });
                document.addEventListener('keydown', function(e){
                    var tag = (e.target && e.target.tagName) || '';
                    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
                    if (e.key === 'Escape') {
                        if (!_self.contextMenu.visible && !_self.showModal && !typing) _self.clearSelection();
                        _self.closeContextMenu();
                    } else if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)
                               && !_self.showModal && !typing) {
                        e.preventDefault();
                        _self.selectAll();
                    }
                });
                window.addEventListener('resize', function(){ _self.closeContextMenu(); });
                window.addEventListener('scroll', function(){ _self.closeContextMenu(); }, true);
            },
            methods: {
                showAddTaskModal: function(){
                    this.modalData.add.url = '';
                    this.modalData.add.ydl_opts.format = '';
                    this.showModal = true;
                    this.modalType = 'addTask';
                    this.$nextTick(function(){
                        this.$refs.url.focus();
                    });
                },
                execFunction: function(){
                    switch(this.modalType) {
                        case 'addTask':
                            this.addTask();
                            break;
                        case 'removeTask':
                            this.removeTask(false);
                            break;
                        case 'updatePreference':
                            this.updatePreference();
                            break;
                        default:
                            this.showModal = false;
                    }
                },
                showRemoveTaskModal: function(){
                    if (!this.requireSelection()) return;
                    this.showModal = true;
                    this.modalType = 'removeTask';
                },
                requireSelection: function() {
                    if (!this.hasSelection) {
                        this.showAlertToast('Select a task first', 'warning');
                        return false;
                    }
                    return true;
                },
                parseResponse: function(res) {
                    var body = typeof res.data === 'string' ? res.data : res.body;
                    try {
                        return JSON.parse(body);
                    } catch (e) {
                        return typeof body === 'object' && body !== null ? body : {status: 'error', errmsg: 'Bad response from server'};
                    }
                },
                errText: function(err) {
                    if (err && err.status === 0) return 'Cannot reach the server';
                    return (err && (err.statusText || err.errmsg)) || 'Request failed';
                },
                addTask: function(){
                    var _self = this;
                    var url = _self.headPath + 'task';
                    var taskUrl = _self.modalData.add.url.trim();
                    if (taskUrl === '') {
                        _self.showAlertToast('Please enter a URL', 'warning');
                        return;
                    }

                    var ydl_opts = {};
                    var fmt = (_self.modalData.add.ydl_opts.format || '').trim();
                    if (fmt !== '' && fmt !== '__CUSTOM__') ydl_opts.format = fmt;

                    Vue.http.post(url, {url: taskUrl, ydl_opts: ydl_opts}, {emulateJSON: false}).then(function(res){
                        var ret = _self.parseResponse(res);
                        if (ret.status === 'error') {
                            _self.showAlertToast(ret.errmsg || 'Could not add task', 'error');
                            return;
                        }
                        _self.showModal = false;
                        if (ret.tids !== undefined) {
                            var msg = 'Playlist: ' + ret.added + ' video(s) added';
                            if (ret.skipped) msg += ', ' + ret.skipped + ' already in the list';
                            _self.showAlertToast(msg, ret.added ? 'success' : 'warning');
                        } else {
                            _self.showAlertToast('Task added', 'success');
                        }
                        that.getTaskList();
                    }, function(err){
                        _self.showAlertToast(_self.errText(err), 'error');
                    });
                },
                updatePreference: function () {
                    var _self = this;
                    var url = _self.headPath + 'config';
                    Vue.http.post(url, _self.modalData.preference, {emulateJSON: false}).then(function(res){
                        var ret = _self.parseResponse(res);
                        if (ret.status === 'error') {
                            _self.showAlertToast(ret.errmsg || 'Could not save preferences', 'error');
                            return;
                        }
                        _self.aboutCustomHtml = _self.modalData.preference.general.about_custom_html || '';
                        _self.showModal = false;
                        _self.showAlertToast('Preferences saved', 'success');
                    }, function(err){
                        _self.showAlertToast(_self.errText(err), 'error');
                    });
                },
                // run pause/resume/delete over every selected task through
                // /task/batch; the core reports per-task failures as
                // detail: [[tid, errmsg], ...] rather than failing the lot
                batchAction: function(act, extra, verb, onDone){
                    var _self = this;
                    var tids = _self.selectedTasks.map(function(v) { return v.tid; });
                    if (tids.length === 0) return;
                    var body = {tids: tids};
                    for (var k in extra) body[k] = extra[k];

                    Vue.http.post(_self.headPath + 'task/batch/' + act, body, {emulateJSON: false}).then(function(res){
                        var ret = _self.parseResponse(res);
                        if (ret.status === 'error') {
                            _self.showAlertToast(ret.errmsg || 'Request failed', 'error');
                            return;
                        }
                        var errors = ret.detail || [];
                        var ok = tids.length - errors.length;
                        var noun = function(n) { return n === 1 ? 'Task' : n + ' tasks'; };
                        if (ok === 0) {
                            _self.showAlertToast(errors[0][1] || 'Could not ' + act + ' task', 'error');
                        } else if (errors.length) {
                            _self.showAlertToast(noun(ok) + ' ' + verb + ', ' + errors.length +
                                                 ' skipped (' + errors[0][1] + ')', 'warning');
                        } else {
                            _self.showAlertToast(noun(ok) + ' ' + verb, act === 'delete' ? 'success' : 'info');
                        }
                        if (onDone) onDone(ok);
                        that.getTaskList();
                    }, function(err){
                        _self.showAlertToast(_self.errText(err), 'error');
                    });
                },
                removeTask: function(removeFile){
                    var _self = this;
                    if (!_self.hasSelection) { _self.showModal = false; return; }
                    _self.batchAction('delete', {del_file: !!removeFile},
                                      removeFile ? 'removed with file' : 'removed', function(){
                        _self.showModal = false;
                        _self.clearSelection();
                    });
                },
                removeData: function(){
                    this.removeTask(true);
                },
                pauseTask: function(){
                    if (!this.requireSelection()) return;
                    this.batchAction('pause', {}, 'paused');
                },
                resumeTask: function(){
                    if (!this.requireSelection()) return;
                    this.batchAction('resume', {}, 'resumed');
                },
                thumbnailSrc: function(detail){
                    // proxied through the server -- the browser using this UI
                    // may have no direct internet access itself
                    return this.headPath + 'thumbnail/' + detail.tid;
                },
                downloadFile: function(){
                    if (!this.requireSelection()) return;
                    var tasks = this.finishedSelection;
                    if (tasks.length === 0) {
                        this.showAlertToast(this.selectedTasks.length === 1
                            ? 'Task is not finished yet' : 'None of the selected tasks are finished', 'warning');
                        return;
                    }
                    if (tasks.length < this.selectedTasks.length) {
                        this.showAlertToast('Downloading ' + tasks.length + ' finished of ' +
                                            this.selectedTasks.length + ' selected', 'info');
                    }
                    // a same-origin <a download> starts a download without
                    // opening a tab, so it isn't caught by popup blockers;
                    // spacing them out stops browsers dropping rapid repeats
                    var headPath = this.headPath;
                    tasks.forEach(function(task, i) {
                        setTimeout(function() {
                            var a = document.createElement('a');
                            a.href = headPath + 'download/' + task.tid;
                            a.setAttribute('download', '');
                            a.style.display = 'none';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        }, i * 400);
                    });
                },
                about: function() {
                    this.showModal = true;
                    this.modalType = 'about';
                    this.loadYdlVersion();
                },
                loadYdlVersion: function() {
                    var _self = this;
                    _self.ydl.checking = true;
                    Vue.http.get(_self.headPath + 'ydl/version').then(function(res){
                        var ret = _self.parseResponse(res);
                        _self.ydl.checking = false;
                        if (ret.status === 'error') return;
                        _self.ydl.installed = ret.installed || '';
                        _self.ydl.latest = ret.latest || '';
                        _self.ydl.updateAvailable = !!ret.update_available;
                    }, function(err){
                        _self.ydl.checking = false;
                    });
                },
                updateYdl: function() {
                    var _self = this;
                    if (_self.ydl.updating) return;
                    _self.ydl.updating = true;
                    Vue.http.post(_self.headPath + 'ydl/update', {}, {emulateJSON: false}).then(function(res){
                        var ret = _self.parseResponse(res);
                        _self.ydl.updating = false;
                        if (ret.status === 'error') {
                            _self.showAlertToast(ret.errmsg || 'Could not update yt-dlp', 'error');
                            return;
                        }
                        if (ret.installed) _self.ydl.installed = ret.installed;
                        _self.ydl.updateAvailable = false;
                        _self.showAlertToast(ret.message || 'yt-dlp updated', 'success');
                    }, function(err){
                        _self.ydl.updating = false;
                        _self.showAlertToast(_self.errText(err), 'error');
                    });
                },
                preference: function() {
                    this.showModal = true;
                    this.modalType = 'updatePreference';
                    this.loadServerConfig();
                },
                loadServerConfig: function(silent) {
                    var _self = this;
                    var url = _self.headPath + 'config';
                    Vue.http.get(url).then(function(res) {
                        var ret = _self.parseResponse(res);
                        if (ret.status === 'error' || !ret.config) {
                            if (!silent) _self.showAlertToast(ret.errmsg || 'Could not load configuration', 'error');
                            return;
                        }
                        var config = ret.config;
                        _self.modalData.preference.general.download_dir = config.general.download_dir;
                        _self.modalData.preference.general.db_path = config.general.db_path;
                        _self.modalData.preference.general.log_size = config.general.log_size;
                        _self.modalData.preference.general.max_concurrent = config.general.max_concurrent;
                        _self.modalData.preference.general.about_custom_html = config.general.about_custom_html || '';
                        _self.modalData.preference.youtube_dl.format = config.youtube_dl.format;
                        _self.modalData.preference.youtube_dl.proxy = config.youtube_dl.proxy;
                        _self.modalData.preference.youtube_dl.ratelimit = config.youtube_dl.ratelimit;
                        _self.modalData.preference.youtube_dl.outtmpl = config.youtube_dl.outtmpl;

                        _self.aboutCustomHtml = config.general.about_custom_html || '';
                        if (config.format_options && config.format_options.format_options) {
                            _self.formatOptions = config.format_options.format_options;
                        }
                    }, function(err){
                        if (!silent) _self.showAlertToast(_self.errText(err), 'error');
                    });
                },
                isSelected: function(tid){
                    return this.selectedTids.indexOf(tid) !== -1;
                },
                focusTask: function(tid){
                    if (this.selectedTid === tid) return;
                    this.selectedTid = tid;
                    this.taskDetails = {};
                    if (tid !== null) this.getTaskInfoById();
                },
                // plain click selects one row, ctrl/cmd-click toggles a row,
                // shift-click selects the range from the anchor row
                selected: function(video, event){
                    event = event || {};
                    if (event.shiftKey && this.anchorTid !== null) {
                        var tids = this.videoList.map(function(v) { return v.tid; });
                        var from = tids.indexOf(this.anchorTid), to = tids.indexOf(video.tid);
                        if (from !== -1) {
                            this.selectedTids = tids.slice(Math.min(from, to), Math.max(from, to) + 1);
                            this.focusTask(video.tid);
                            return;
                        }
                    }
                    if (event.ctrlKey || event.metaKey) {
                        this.toggleRow(video);
                        return;
                    }
                    this.selectedTids = [video.tid];
                    this.anchorTid = video.tid;
                    this.focusTask(video.tid);
                },
                toggleRow: function(video){
                    var i = this.selectedTids.indexOf(video.tid);
                    if (i === -1) {
                        this.selectedTids.push(video.tid);
                        this.focusTask(video.tid);
                    } else {
                        this.selectedTids.splice(i, 1);
                        if (this.selectedTid === video.tid) {
                            this.focusTask(this.selectedTids.length ? this.selectedTids[this.selectedTids.length - 1] : null);
                        }
                    }
                    this.anchorTid = video.tid;
                },
                toggleAll: function(){
                    if (this.allSelected) this.clearSelection();
                    else this.selectAll();
                },
                selectAll: function(){
                    this.selectedTids = this.videoList.map(function(v) { return v.tid; });
                    if (this.selectedTid === null && this.selectedTids.length) {
                        this.anchorTid = this.selectedTids[0];
                        this.focusTask(this.selectedTids[0]);
                    }
                },
                clearSelection: function(){
                    this.selectedTids = [];
                    this.anchorTid = null;
                    this.focusTask(null);
                },
                // -- format preset picker: shared by the Preferences and Add
                // Task modals ('preference' / 'add') --
                formatModel: function(target) {
                    return target === 'preference'
                        ? this.modalData.preference.youtube_dl
                        : this.modalData.add.ydl_opts;
                },
                getFormatPresets: function(target) {
                    var baseOptions = this.formatOptions || [];
                    if (target !== 'add') return baseOptions;

                    var preferencesFormat = this.modalData.preference.youtube_dl.format;
                    var label = 'Use preferences format';
                    if (preferencesFormat && preferencesFormat.trim() !== '') {
                        var match = baseOptions.filter(function(p){ return p.value === preferencesFormat; })[0];
                        label = match ? 'Use preferences format (' + match.label + ')' : 'Use preferences format (custom)';
                    }
                    return [{ label: label, value: '__PREFERENCES__' }].concat(baseOptions);
                },
                getSelectedFormatPreset: function(target) {
                    var currentFormat = this.formatModel(target).format;
                    var presets = this.getFormatPresets(target);
                    var match = presets.filter(function(p){ return p.value === currentFormat; })[0];
                    if (match) return match.value;
                    return (currentFormat && currentFormat.trim() !== '') ? '__CUSTOM__' : '';
                },
                selectFormatPreset: function(preset, target) {
                    var _self = this;
                    if (preset === '__CUSTOM__') {
                        this.$nextTick(function(){
                            if (_self.$refs.format) _self.$refs.format.focus();
                        });
                        return;
                    }
                    if (target === 'add' && preset === '__PREFERENCES__') {
                        this.modalData.add.ydl_opts.format = this.modalData.preference.youtube_dl.format || '';
                        return;
                    }
                    this.formatModel(target).format = preset;
                },
                clearFormat: function(target) {
                    this.formatModel(target).format = '';
                },
                onFormatInputBlur: function(target) {
                    // no-op: the dropdown's displayed selection is already
                    // derived live from the text input via getSelectedFormatPreset
                },
                openContextMenu: function(event, video){
                    // right-clicking inside the selection acts on all of it;
                    // right-clicking elsewhere selects just that row
                    if (this.isSelected(video.tid)) {
                        this.focusTask(video.tid);
                    } else {
                        this.selected(video);
                    }

                    this.contextMenu.x = event.clientX;
                    this.contextMenu.y = event.clientY;
                    this.contextMenu.visible = true;

                    var _self = this;
                    this.$nextTick(function(){
                        _self.clampContextMenu();
                    });
                },
                clampContextMenu: function(){
                    var el = this.$refs.contextMenu;
                    if (!el) return;
                    var rect = el.getBoundingClientRect();
                    var maxX = window.innerWidth - rect.width - 4;
                    var maxY = window.innerHeight - rect.height - 4;
                    if (this.contextMenu.x > maxX) this.contextMenu.x = Math.max(4, maxX);
                    if (this.contextMenu.y > maxY) this.contextMenu.y = Math.max(4, maxY);
                },
                closeContextMenu: function(){
                    this.contextMenu.visible = false;
                },
                ctxPause: function(){
                    this.pauseTask();
                    this.closeContextMenu();
                },
                ctxResume: function(){
                    this.resumeTask();
                    this.closeContextMenu();
                },
                ctxDownload: function(){
                    if (this.canDownload) this.downloadFile();
                    this.closeContextMenu();
                },
                ctxRemove: function(){
                    this.showRemoveTaskModal();
                    this.closeContextMenu();
                },
                getTaskInfoById: function(){
                    var _self = this;
                    if (_self.selectedTid === null) return;
                    var url = _self.headPath + 'task/tid/' + _self.selectedTid + '/status';
                    Vue.http.get(url).then(function(res){
                        var ret = _self.parseResponse(res);
                        if (ret.status === 'error') return;
                        _self.taskDetails = ret.detail;
                    }, function(err){
                        // list polling already reports connectivity problems
                    });
                },
                filterTasks: function(filterStatus) {
                    this.status = filterStatus;
                    that.getTaskList();
                },
                speedConv: function(state, value) {
                    if (state === 'downloading')
                        return this.bitsToHuman(value) + '/s';
                    return '—';
                },
                etaConv: function(state, value) {
                    if (state === 'downloading')
                        return this.secondsToHuman(value);
                    return '—';
                },
                progressConv: function(state, value) {
                    if (state === 'finished')
                        return 'Done';
                    if (state === 'invalid')
                        return 'Error';
                    return value || '0%';
                },
                progressWidth: function(video) {
                    if (video.state === 'finished') return '100%';
                    var p = parseFloat(video.percent);
                    if (isNaN(p) || p < 0) p = 0;
                    if (p > 100) p = 100;
                    return p + '%';
                },
                bitsToHuman: function(value) {
                    var tmp = Number(value), count = 0;
                    if (isNaN(tmp) || tmp <= 0)
                        return '0 B';
                    var metricList = [' B', ' KB', ' MB', ' GB', ' TB', ' PB'];

                    while (tmp / 1024 >= 1 && count < metricList.length - 1) {
                        tmp = tmp / 1024;
                        count++;
                    }
                    return tmp.toFixed(count === 0 ? 0 : 2) + metricList[count];
                },
                secondsToHuman: function(value) {
                    var secs = Number(value);
                    if (isNaN(secs) || secs < 0)
                        return '—';
                    secs = Math.floor(secs);
                    var d = Math.floor(secs / 86400);
                    var h = Math.floor((secs % 86400) / 3600);
                    var m = Math.floor((secs % 3600) / 60);
                    var s = secs % 60;
                    var out = '';
                    if (d > 0) out += d + 'd ';
                    if (h > 0 || d > 0) out += h + 'h ';
                    if (m > 0 || h > 0 || d > 0) out += m + 'm ';
                    out += s + 's';
                    return out;
                },
                stateIcon: function(state) {
                    if (state === 'downloading')
                        return {'icon': 'fa-arrow-circle-o-down', 'cls': 'state-downloading'};
                    else if (state === 'paused')
                        return {'icon': 'fa-pause-circle-o', 'cls': 'state-paused'};
                    else if (state === 'finished')
                        return {'icon': 'fa-check-circle-o', 'cls': 'state-finished'};
                    else
                        return {'icon': 'fa-times-circle-o', 'cls': 'state-invalid'};
                },
                tsToLocal: function(timeStamp) {
                    if (typeof timeStamp == 'undefined' || Number(timeStamp) < 10)
                        return '—';

                    var options = {
                        year: "numeric", month: "short", hour12: false,
                        day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
                    };
                    var d = new Date(0);
                    d.setUTCSeconds(timeStamp);
                    return d.toLocaleString('en-US', options);
                },
                resetOptions() {
                    this.$refs.toast.setOptions({
                        delayOfJumps: this.delayOfJumps,
                        maxToasts: this.maxToasts,
                        position: this.position
                    });
                },
                showAlertToast(msg, theme) {
                    this.$refs.toast.showToast(String(msg), {
                        theme: theme || 'info',
                        timeLife: this.timeLife,
                        closeBtn: this.closeBtn
                    });
                }
            }
        });
    };

    videoDownload.getTaskList = function() {
        var that = videoDownload;
        var url = that.tasksData.headPath + 'task/list';
        url = url + '?state=' + that.tasksData.status;
        Vue.http.get(url).then(function(res){
            var resData;
            try {
                resData = JSON.parse(res.body);
            } catch (e) {
                return;
            }
            if (resData.status === 'error') return;

            that.tasksData.fetchFailures = 0;
            that.tasksData.videoList = resData.detail;
            that.tasksData.stateCounter = resData.state_counter;
            that.tasksData.stateCounter.all = that.tasksData.stateCounter.downloading +
                                              that.tasksData.stateCounter.finished +
                                              that.tasksData.stateCounter.paused +
                                              that.tasksData.stateCounter.invalid;

            // keep the multi-selection to rows that are actually listed, so a
            // batch action never touches tasks hidden by the filter (or
            // deleted elsewhere)
            var listed = {};
            resData.detail.forEach(function(v) { listed[v.tid] = true; });
            var kept = that.tasksData.selectedTids.filter(function(tid) { return listed[tid]; });
            if (kept.length !== that.tasksData.selectedTids.length) {
                that.tasksData.selectedTids = kept;
            }

            // drop the focused task if it vanished (e.g. deleted elsewhere)
            if (that.tasksData.selectedTid !== null) {
                var found = resData.detail.some(function(v) {
                    return v.tid === that.tasksData.selectedTid;
                });
                if (!found && that.tasksData.status === 'all') {
                    that.tasksData.selectedTid = null;
                    that.tasksData.taskDetails = {};
                }
            }
        }, function(err){
            // only complain once per connectivity loss, not every 3 seconds
            that.tasksData.fetchFailures++;
            if (that.vm && that.tasksData.fetchFailures === 1) {
                that.vm.showAlertToast('Lost connection to the server', 'error');
            }
        });
    };

    videoDownload.timeOut = function(){
        var that = videoDownload;
        that.getTaskList();
        that.vm.getTaskInfoById();
    };

    videoDownload.init = function(){
        var that = this;
        that.tasksData.headPath = window.location.protocol + '//' + window.location.host + '/';
        that.createVm();
        that.getTaskList();
    }

    return videoDownload;
})(Vue, {});


videoDownload.init();
