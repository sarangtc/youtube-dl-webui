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
            preference: {youtube_dl: {format: '', proxy: '', ratelimit: '', outtmpl: ''}, general: {download_dir: '', db_path: '', log_size: '', about_custom_html: ''}},
        },
        aboutCustomHtml: '',
        formatOptions: [],
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
                    this.modalData.add.ydl_opts.format = this.modalData.preference.youtube_dl.format || '';
                    this.updateAddTaskFormatLabel();
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
                            _self.modalData.preference.general.about_custom_html = config.general.about_custom_html || '';
                            _self.modalData.preference.youtube_dl.format = config.youtube_dl.format;
                            _self.modalData.preference.youtube_dl.proxy = config.youtube_dl.proxy;
                            _self.modalData.preference.youtube_dl.ratelimit = config.youtube_dl.ratelimit;
                            _self.modalData.preference.youtube_dl.outtmpl = config.youtube_dl.outtmpl;
                            
                            // Load custom HTML for about modal
                            _self.aboutCustomHtml = config.general.about_custom_html || '';
                            
                            // Load format options from config
                            if (config.format_options && config.format_options.format_options) {
                                _self.formatOptions = config.format_options.format_options;
                            }
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
                            // Update the aboutCustomHtml with the new value
                            _self.aboutCustomHtml = _self.modalData.preference.general.about_custom_html || '';
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
                            _self.modalData.preference.general.about_custom_html = config.general.about_custom_html || '';
                            _self.modalData.preference.youtube_dl.format = config.youtube_dl.format;
                            _self.modalData.preference.youtube_dl.proxy = config.youtube_dl.proxy;
                            _self.modalData.preference.youtube_dl.ratelimit = config.youtube_dl.ratelimit;
                            _self.modalData.preference.youtube_dl.outtmpl = config.youtube_dl.outtmpl;
                            
                            // Load format options from config
                            if (config.format_options && config.format_options.format_options) {
                                _self.formatOptions = config.format_options.format_options;
                            }
                            
                            // Update add task format label after loading preferences
                            _self.updateAddTaskFormatLabel();
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
                        if (preset === '__CUSTOM__') {
                            // Focus the format text input for custom format
                            this.$nextTick(function() {
                                if (this.$refs.format) {
                                    this.$refs.format.focus();
                                }
                            });
                            return;
                        } else {
                            this.modalData.preference.youtube_dl.format = preset;
                        }
                    } else if (target === 'add') {
                        if (preset === '__PREFERENCES__') {
                            // Use the format from preferences
                            this.modalData.add.ydl_opts.format = this.modalData.preference.youtube_dl.format || '';
                        } else if (preset === '__CUSTOM__') {
                            // Focus the format text input for custom format
                            this.$nextTick(function() {
                                if (this.$refs.format) {
                                    this.$refs.format.focus();
                                }
                            });
                            return;
                        } else {
                            this.modalData.add.ydl_opts.format = preset;
                        }
                    }
                },
                getFormatPresets: function(target) {
                    var baseOptions = this.formatOptions || [];
                    if (target === 'preference') {
                        return baseOptions;
                    } else if (target === 'add') {
                        // Add "Use preferences format" option at the beginning for add task modal
                        var preferencesFormat = this.modalData.preference.youtube_dl.format;
                        var label = 'Use preferences format';
                        
                        if (preferencesFormat && preferencesFormat.trim() !== '') {
                            // Check if preferences format matches any preset
                            var isCustom = true;
                            for (var j = 0; j < baseOptions.length; j++) {
                                if (baseOptions[j].value === preferencesFormat) {
                                    label = 'Use preferences format (' + baseOptions[j].label + ')';
                                    isCustom = false;
                                    break;
                                }
                            }
                            if (isCustom) {
                                label = 'Use preferences format (custom)';
                            }
                        }
                        
                        var addTaskOptions = [{ label: label, value: '__PREFERENCES__' }];
                        return addTaskOptions.concat(baseOptions);
                    }
                    return [];
                },
                getSelectedFormatPreset: function(target) {
                    var currentFormat = '';
                    var presets = this.getFormatPresets(target);
                    
                    if (target === 'preference') {
                        currentFormat = this.modalData.preference.youtube_dl.format;
                    } else if (target === 'add') {
                        currentFormat = this.modalData.add.ydl_opts.format;
                    }
                    
                    // Check if current format matches any preset
                    for (var i = 0; i < presets.length; i++) {
                        if (presets[i].value === currentFormat) {
                            return presets[i].value;
                        }
                    }
                    
                    // If no match found and format is not empty, return custom
                    if (currentFormat && currentFormat.trim() !== '') {
                        return '__CUSTOM__';
                    }
                    
                    return '';
                },
                updateAddTaskFormatLabel: function() {
                    var preferencesFormat = this.modalData.preference.youtube_dl.format;
                    
                    if (preferencesFormat && preferencesFormat.trim() !== '') {
                        // Check if preferences format matches any preset
                        var isCustom = true;
                        for (var j = 0; j < this.formatOptions.length; j++) {
                            if (this.formatOptions[j].value === preferencesFormat) {
                                // Update the label dynamically when getFormatPresets is called
                                isCustom = false;
                                break;
                            }
                        }
                        // Store the custom status for use in getFormatPresets
                        this.preferencesFormatIsCustom = isCustom;
                    } else {
                        this.preferencesFormatIsCustom = false;
                    }
                },
                clearFormat: function(target) {
                    if (target === 'preference') {
                        this.modalData.preference.youtube_dl.format = '';
                    } else if (target === 'add') {
                        this.modalData.add.ydl_opts.format = '';
                    }
                },
                onFormatInputBlur: function(target) {
                    // Check if the current format matches any preset when input loses focus
                    var currentFormat = '';
                    var presets = this.getFormatPresets(target);
                    
                    if (target === 'preference') {
                        currentFormat = this.modalData.preference.youtube_dl.format;
                    } else if (target === 'add') {
                        currentFormat = this.modalData.add.ydl_opts.format;
                    }
                    
                    // Check if current format matches any preset
                    for (var i = 0; i < presets.length; i++) {
                        if (presets[i].value === currentFormat) {
                            // Format matches a preset, no need to change dropdown
                            return;
                        }
                    }
                    
                    // If no match found and format is not empty, the dropdown should show "Custom format"
                    // This will be handled by the getSelectedFormatPreset function
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
