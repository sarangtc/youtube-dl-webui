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
        selectedTid: null,
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
                hasSelection: function() {
                    return this.selectedTask !== null;
                },
                canDownload: function() {
                    return this.selectedTask !== null && this.selectedTask.state === 'finished';
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
                    if (e.key === 'Escape') _self.closeContextMenu();
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
                removeTask: function(removeFile){
                    var _self = this;
                    if (!_self.hasSelection) { _self.showModal = false; return; }
                    var url = _self.headPath + 'task/tid/' + _self.selectedTask.tid;
                    if (removeFile) {
                        url += '?del_file=true';
                    }
                    Vue.http.delete(url).then(function(res){
                        var ret = _self.parseResponse(res);
                        if (ret.status === 'error') {
                            _self.showAlertToast(ret.errmsg || 'Could not remove task', 'error');
                            return;
                        }
                        _self.showModal = false;
                        _self.selectedTid = null;
                        _self.taskDetails = {};
                        _self.showAlertToast(removeFile ? 'Task and file removed' : 'Task removed', 'success');
                        that.getTaskList();
                    }, function(err){
                        _self.showAlertToast(_self.errText(err), 'error');
                    });
                },
                removeData: function(){
                    this.removeTask(true);
                },
                pauseTask: function(){
                    var _self = this;
                    if (!_self.requireSelection()) return;
                    var url = _self.headPath + 'task/tid/' + _self.selectedTask.tid + '?act=pause';
                    Vue.http.put(url).then(function(res){
                        var ret = _self.parseResponse(res);
                        if (ret.status === 'error') {
                            _self.showAlertToast(ret.errmsg || 'Could not pause task', 'error');
                            return;
                        }
                        _self.showAlertToast('Task paused', 'info');
                        that.getTaskList();
                    }, function(err){
                        _self.showAlertToast(_self.errText(err), 'error');
                    });
                },
                resumeTask: function(){
                    var _self = this;
                    if (!_self.requireSelection()) return;
                    var url = _self.headPath + 'task/tid/' + _self.selectedTask.tid + '?act=resume';
                    Vue.http.put(url).then(function(res){
                        var ret = _self.parseResponse(res);
                        if (ret.status === 'error') {
                            _self.showAlertToast(ret.errmsg || 'Could not resume task', 'error');
                            return;
                        }
                        _self.showAlertToast('Task resumed', 'info');
                        that.getTaskList();
                    }, function(err){
                        _self.showAlertToast(_self.errText(err), 'error');
                    });
                },
                thumbnailSrc: function(detail){
                    // proxied through the server -- the browser using this UI
                    // may have no direct internet access itself
                    return this.headPath + 'thumbnail/' + detail.tid;
                },
                downloadFile: function(){
                    if (!this.requireSelection()) return;
                    if (this.selectedTask.state !== 'finished') {
                        this.showAlertToast('Task is not finished yet', 'warning');
                        return;
                    }
                    window.open(this.headPath + 'download/' + this.selectedTask.tid, '_blank');
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
                selected: function(video){
                    this.selectedTid = video.tid;
                    this.getTaskInfoById();
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
                    this.selectedTid = video.tid;
                    this.getTaskInfoById();

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

            // drop the selection if the task vanished (e.g. deleted elsewhere)
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
