var videoDownload = (function (Vue, extendAM){
    var videoDownload = {};
    var VueToast = window.vueToasts ? window.vueToasts.default || window.vueToasts : window.vueToasts;
    videoDownload.vm = null;
    videoDownload.tasksData = {
        headPath: 'http://localhost:5000/',
        videoList: [],
        videoListCopy: [],
        showModal: false,
        modalType: 'addTask',
        // tablist: ['status', 'details', 'file24s', 'peers', 'options'],
        tablist: ['Status', 'Details', 'Log'],
        showTab: 'Status',
        stateCounter: { all: 0, downloading: 0, finished: 0, paused: 0, invalid: 0},
        modalData: {
            add: { url: '', ydl_opts: {} },
            remove: { removeFile: false },
            preference: {youtube_dl: {format: '', proxy: '', ratelimit: '', outtmpl: ''}, general: {download_dir: '', db_path: '', log_size: ''}},
        },
        formatPresets: [
            { label: 'Use preferences format', value: '__PREFERENCES__' },
            { label: 'Best Quality', value: 'best' },
            { label: 'Best Quality MP4', value: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' },
            { label: '1080p MP4 H.264 preferred', value: 'bestvideo[ext=mp4][height<=?1080][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[ext=mp4][height<=?1080]+bestaudio[ext=m4a]/best[ext=mp4]/best' },
            { label: '1080p MP4 H.265 preferred', value: 'bestvideo[ext=mp4][height<=?1080][vcodec^=hevc]+bestaudio[ext=m4a]/bestvideo[ext=mp4][height<=?1080][vcodec^=hvc1]+bestaudio[ext=m4a]/bestvideo[ext=mp4][height<=?1080]+bestaudio[ext=m4a]/best[ext=mp4]/best' },
            { label: '720p MP4', value: 'best[height<=720][ext=mp4]/best[height<=720]/best' },
            { label: '480p MP4', value: 'best[height<=480][ext=mp4]/best[height<=480]/best' },
            { label: '360p MP4', value: 'best[height<=360][ext=mp4]/best[height<=360]/best' },
            { label: 'Best Video Only', value: 'bestvideo[ext=mp4][height<=?1080]/bestvideo[ext=mp4]/bestvideo' },
            { label: 'Best Audio Only', value: 'bestaudio[ext=m4a]/bestaudio' },
            { label: 'Audio Only (MP3)', value: 'bestaudio[ext=mp3]/bestaudio' },
            { label: 'Audio Only (M4A)', value: 'bestaudio[ext=m4a]/bestaudio' }
        ],
        currentSelected: null,
        taskDetails: {},
        taskInfoUrl: null,
        status: 'all',
        maxToasts: 4,
        position: 'bottom right',
        theme: 'error',
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
            watch:{
                stateCounter: function(val){
                    val.all = val.downloading + val.finished + val.paused + val.invalid;
                }
            },
            mounted: function () {
                this.resetOptions();
                setInterval(videoDownload.timeOut, 3000);
                this.loadPreferences();
            },
            methods: {
                showAddTaskModal: function(){
                    this.modalData.add.url = '';
                    this.showModal = true;
                    this.modalType = 'addTask';
                    console.log(this.modalData);
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
                            this.removeTask();
                            break;
                        case 'updatePreference':
                            this.updatePreference();
                            break;
                    }
                },
                showRemoveTaskModal: function(){
                    this.modalData.remove.removeFile = false;
                    this.showModal = true;
                    this.modalType = 'removeTask';
                },
                loadPreferences: function() {
                    var _self = this;
                    var url = _self.headPath + 'config';
                    Vue.http.get(url).then(function(res) {
                        var responseJSON = JSON.parse(res.data);
                        if (responseJSON.status === 'success') {
                            var config = responseJSON['config'];
                            _self.modalData.preference.general.download_dir = config.general.download_dir;
                            _self.modalData.preference.general.db_path = config.general.db_path;
                            _self.modalData.preference.general.log_size = config.general.log_size;
                            _self.modalData.preference.youtube_dl.format = config.youtube_dl.format;
                            _self.modalData.preference.youtube_dl.proxy = config.youtube_dl.proxy;
                            _self.modalData.preference.youtube_dl.ratelimit = config.youtube_dl.ratelimit;
                            _self.modalData.preference.youtube_dl.outtmpl = config.youtube_dl.outtmpl;
                        }
                    });
                },
                addTask: function(){
                    var _self = this;
                    var url = _self.headPath + 'task';
                    
                    // Merge saved preferences with task-specific options
                    var ydl_opts = {};
                    if (_self.modalData.preference.youtube_dl.format) {
                        ydl_opts.format = _self.modalData.preference.youtube_dl.format;
                    }
                    if (_self.modalData.preference.youtube_dl.proxy) {
                        ydl_opts.proxy = _self.modalData.preference.youtube_dl.proxy;
                    }
                    if (_self.modalData.preference.youtube_dl.outtmpl) {
                        ydl_opts.outtmpl = _self.modalData.preference.youtube_dl.outtmpl;
                    }
                    if (_self.modalData.preference.youtube_dl.ratelimit) {
                        ydl_opts.ratelimit = _self.modalData.preference.youtube_dl.ratelimit;
                    }
                    
                    // Override with task-specific options if provided
                    for (var key in _self.modalData.add.ydl_opts) {
                        if (_self.modalData.add.ydl_opts[key] && _self.modalData.add.ydl_opts[key].trim() != '') {
                            ydl_opts[key] = _self.modalData.add.ydl_opts[key];
                        }
                    }
                    
                    var taskData = {
                        url: _self.modalData.add.url,
                        ydl_opts: ydl_opts
                    };
                    
                    Vue.http.post(url, taskData, {emulateJSON: false}).then(function(res){
                        _self.showModal = false;
                        that.getTaskList();
                    }, function(err){
                        _self.showAlertToast(err, 'error');
                    });
                },
                updatePreference: function () {
                    var _self = this;
                    var url = _self.headPath + 'config';
                    var data = {
                        act: 'update',
                        ..._self.modalData.preference
                    };
                    Vue.http.post(url, data, {emulateJSON: false}).then(function(res){
                        var responseJSON = JSON.parse(res.data);
                        if (responseJSON.status === 'success') {
                            _self.showAlertToast('Preferences saved successfully', 'success');
                            _self.showModal = false;
                        } else {
                            _self.showAlertToast('Failed to save preferences', 'error');
                        }
                    }, function(err){
                        _self.showAlertToast(err, 'error');
                    });
                },
                removeTask: function(){
                    var _self = this;
                    var url = _self.headPath + 'task/tid/' + (_self.videoList[_self.currentSelected] && _self.videoList[_self.currentSelected].tid);
                    if(_self.modalData.remove.removeFile){
                        url += '?del_file=true';
                    }
                    Vue.http.delete(url).then(function(res){
                        _self.showAlertToast('Task Delete', 'info');
                        _self.videoList.splice(_self.currentSelected, _self.currentSelected+1);
                        _self.showModal = false;
                        that.getTaskList();
                    }, function(err){
                        _self.showAlertToast(err, 'error');
                    });
                },
                removeData: function(){
                    this.modalData.remove.removeFile = true;
                    this.removeTask();
                },
                pauseTask: function(){
                    var _self = this;
                    var url = _self.headPath + 'task/tid/' +  (_self.videoList[_self.currentSelected] && _self.videoList[_self.currentSelected].tid) + '?act=pause';
                    Vue.http.put(url).then(function(res){
                        _self.showAlertToast('Task Pause', 'info');
                        that.getTaskList();
                    }, function(err){
                        _self.showAlertToast(err, 'error');
                    });
                },
                resumeTask: function(){
                    var _self = this;
                    var url = _self.headPath + 'task/tid/' + (_self.videoList[_self.currentSelected] && _self.videoList[_self.currentSelected].tid) + '?act=resume';
                    Vue.http.put(url).then(function(res){
                        _self.showAlertToast('Task Resume', 'info');
                        that.getTaskList();
                    }, function(err){
                        _self.showAlertToast(err, 'error');
                    });
                },
                downloadFile: function(){
                    var _self = this;
                    var video = _self.videoList[_self.currentSelected];
                    if (video && video.state === 'finished') {
                        // Create a download link for the file
                        var downloadUrl = _self.headPath + 'download/' + video.tid;
                        var link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = video.filename || video.title + '.mp4';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        _self.showAlertToast('Download started', 'success');
                    }
                },
                about: function() {
                    this.showModal = true;
                    this.modalType = 'about';
                },
                preference: function() {
                    var _self = this;
                    var url = _self.headPath + 'config';

                    this.showModal = true;
                    this.modalType = 'updatePreference';
                    Vue.http.get(url).then(function(res) {
                        var responseJSON = JSON.parse(res.data);
                        if (responseJSON.status === 'error') {
                            return false;
                        } else {
                            config = responseJSON['config'];
                            _self.modalData.preference.general.download_dir = config.general.download_dir;
                            _self.modalData.preference.general.db_path = config.general.db_path;
                            _self.modalData.preference.general.log_size = config.general.log_size;
                            _self.modalData.preference.youtube_dl.format = config.youtube_dl.format;
                            _self.modalData.preference.youtube_dl.proxy = config.youtube_dl.proxy;
                            _self.modalData.preference.youtube_dl.ratelimit = config.youtube_dl.ratelimit;
                            _self.modalData.preference.youtube_dl.outtmpl = config.youtube_dl.outtmpl;
                        }
                    });
                },
                selected: function(index){
                    var _self = this;
                    this.currentSelected = index;
                    _self.taskInfoUrl = _self.headPath + 'task/tid/' +  (_self.videoList[_self.currentSelected] && _self.videoList[_self.currentSelected].tid) + '/status';
                    _self.getTaskInfoById();
                },
                getTaskInfoById: function(){
                    var _self = this;
                    if(!_self.taskInfoUrl) return false;
                    Vue.http.get(_self.taskInfoUrl).then(function(res){
                        var responseJSON = JSON.parse(res.data);
                        if(responseJSON.status === 'error'){
                            return false;
                        }
                        _self.taskDetails = responseJSON.detail;
                    }, function(err){
                        _self.showAlertToast('Network connection lost', 'error');
                    });
                },
                filterTasks: function(filterStatus) {
                    var _self = this;
                    _self.status = filterStatus;
                    that.getTaskList();
                },
                speedConv: function(state, value) {
                    if (state == 'paused' || state == 'invalid')
                        return 'Paused';
                    else if (state == 'finished')
                        return 'Done';
                    return this.bitsToHuman(value) + '/s';
                },
                etaConv: function(state, value) {
                    if (state == 'paused' || state == 'invalid')
                        return 'Paused';
                    else if (state == 'finished')
                        return 'Done';
                    return this.secondsToHuman(value);
                },
                progressConv: function(state, value) {
                    if (state == 'finished')
                        return 'Done';
                    return value;
                },
                bitsToHuman: function(value) {
                    var tmp = value, count = 0;
                    var metricList = [' B', ' KB', ' M', ' G', ' T',' P',' E',' Z'];

                    while(tmp/1024 > 1){
                        tmp = tmp/1024;
                        count++;
                    }
                    return tmp.toFixed(2) + metricList[count];
                },
                secondsToHuman: function(value) {
                    var tmp = '';
                    tmp = value % 60 + 's';
                    value = value/ 60;
                    if(value > 1) {
                        tmp = parseInt(value % 60) + 'm' + tmp;
                        value = value / 60;
                        if(value > 1) {
                            tmp = parseInt(value % 60) + 'h' + tmp;
                            value = value / 24;
                            if(value > 1) {
                                tmp += parseInt(value % 24) + 'd' + tmp;
                            }
                        }
                    }
                    return tmp;
                },
                stateIcon: function(state) {
                    if (state == 'downloading')
                        return {'icon': 'fa-arrow-circle-o-down', 'color': 'blue'};
                    else if (state == 'paused')
                        return {'icon': 'fa-pause-circle-o', 'color': 'green'};
                    else if (state == 'finished')
                        return {'icon': 'fa-check-circle-o', 'color': 'grey'};
                    else
                        return {'icon': 'fa-times-circle-o', 'color': 'red'};
                },
                tsToLocal: function(timeStamp) {
                    if (typeof timeStamp == 'undefined' || Number(timeStamp) < 10)
                        return '';

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
                    this.$refs.toast.showToast(msg, {
                        theme: theme,
                        timeLife: this.timeLife,
                        closeBtn: this.closeBtn
                    });
                },
                selectFormatPreset: function(preset, target) {
                    if (target === 'preference') {
                        this.modalData.preference.youtube_dl.format = preset;
                    } else if (target === 'add') {
                        if (preset === '__PREFERENCES__') {
                            // Use the format from preferences
                            this.modalData.add.ydl_opts.format = this.modalData.preference.youtube_dl.format || '';
                        } else {
                            this.modalData.add.ydl_opts.format = preset;
                        }
                    }
                },
                clearFormat: function(target) {
                    if (target === 'preference') {
                        this.modalData.preference.youtube_dl.format = '';
                    } else if (target === 'add') {
                        this.modalData.add.ydl_opts.format = '';
                    }
                }
            }
        });
    };

    videoDownload.getTaskList = function() {
        var that = videoDownload;
        var url = that.tasksData.headPath + 'task/list';
        url = url + '?state=' + that.tasksData.status;
        Vue.http.get(url).then(function(res){
            var resData = JSON.parse(res.body);
            that.tasksData.videoList = resData.detail;
            that.tasksData.stateCounter = resData.state_counter;
            that.tasksData.stateCounter.all = that.tasksData.stateCounter.downloading +
                                              that.tasksData.stateCounter.finished +
                                              that.tasksData.stateCounter.paused +
                                              that.tasksData.stateCounter.invalid;
        }, function(err){
            that.vm.showAlertToast('Network connection lost', 'error');
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
