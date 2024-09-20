(function(Backbone, $) {
    'use strict';

    var examStatusReadableFormat, notStartedText, startedText, submittedText;

    // warning threshold for "onboarding expires soon"
    var twentyeightDays = 28 * 24 * 60 * 60 * 1000;

    edx.courseware = edx.courseware || {};
    edx.courseware.proctored_exam = edx.courseware.proctored_exam || {};

    notStartedText = {
        status: gettext('未开始'),
        message: gettext('您尚未开始入职考试。')
    };
    startedText = {
        status: gettext('已开始'),
        message: gettext('您已开始入职考试。')
    };
    submittedText = {
        status: gettext('已提交'),
        message: gettext('您已提交入职考试。')
    };

    examStatusReadableFormat = {
        created: notStartedText,
        download_software_clicked: notStartedText,
        ready_to_start: notStartedText,
        started: startedText,
        ready_to_submit: startedText,
        second_review_required: submittedText,
        submitted: submittedText,
        verified: {
            status: gettext('已验证'),
            message: gettext('您的入职考试已通过本课程的审核。')
        },
        rejected: {
            status: gettext('已拒绝'),
            message: gettext('您的入职考试已被拒绝。请重新进行入职考试。')
        },
        error: {
            status: gettext('错误'),
            message: gettext('入职考试过程中发生错误。请重新进行入职考试。')
        },
        other_course_approved: {
            status: gettext('已在其他课程中通过'),
            message: gettext('您的入职考试已在另一门课程中通过。'),
            detail: gettext(
                '如果您的设备发生了更改，我们建议您完成本课程的入职考试，' +
                '以确保您的设备设置仍符合监考要求。'
            )
        },
        expiring_soon: {
            status: gettext('即将过期'),
            message: gettext(
                '您的入职资料已通过审核。' +
                '但是，您的入职状态即将过期。请再次完成入职考试，' +
                '以确保您能够继续参加监考考试。'
            )
        },
        expired: {
            status: gettext('已过期'),
            message: gettext(
                '您的入职状态已过期。请再次完成入职考试，' +
                '以继续参加监考考试。'
            )
        }
    };

    edx.courseware.proctored_exam.ProctoredExamInfo = Backbone.View.extend({
        initialize: function() {
            this.course_id = this.$el.data('course-id');
            this.username = this.$el.data('username');
            this.model.url = this.model.url + '?course_id=' + encodeURIComponent(this.course_id);
            if (this.username) {
                this.model.url = this.model.url + '&username=' + encodeURIComponent(this.username);
            }
            this.template_url = '/static/proctoring/templates/proctored-exam-info.underscore';
            this.status = '';

            this.loadTemplateData();
        },

        updateCss: function() {
            var $el = $(this.el);
            var color = '#b20610';
            if (['verified', 'other_course_approved'].includes(this.status)) {
                color = '#008100';
            } else if (['submitted', 'second_review_required', 'expiring_soon'].includes(this.status)) {
                color = '#0d4e6c';
            }

            $el.find('.proctoring-info').css({
                padding: '10px',
                border: '1px solid #e7e7e7',
                'border-top': '5px solid ' + color,
                'margin-bottom': '15px'
            });

            $el.find('.onboarding-status').css({
                'font-weight': 'bold',
                'margin-bottom': '15px'
            });

            $el.find('.onboarding-status-message').css({
                'margin-bottom': '15px'
            });

            $el.find('.onboarding-status-detail').css({
                'font-size': '0.8rem',
                'margin-bottom': '15px'
            });

            $el.find('.action').css({
                display: 'block',
                'font-weight': '600',
                'text-align': 'center',
                'text-decoration': 'none',
                padding: '15px 20px',
                border: 'none'
            });

            $el.find('.action-onboarding').css({
                color: '#ffffff',
                background: '#98050e',
                'margin-bottom': '15px'
            });

            $el.find('.action-onboarding-practice').css({
                color: '#ffffff',
                background: '#0075b4',
                'margin-bottom': '15px'
            });

            $el.find('.action-disabled').css({
                background: '#b4b6bd'
            });

            $el.find('.action-info-link').css({
                border: '1px solid #0d4e6c'
            });
        },

        getExamAttemptText: function(status) {
            if (status in examStatusReadableFormat) {
                return examStatusReadableFormat[status];
            } else {
                return {status: status || 'Not Started', message: ''};
            }
        },

        isExpiringSoon: function(expirationDate) {
            // returns true if expiring soon, returns false if not soon or already expired
            var expirationTime = new Date(expirationDate).getTime();
            var now = new Date().getTime();
            return (!this.isExpired(expirationDate))
                && (now > (expirationTime - twentyeightDays));
        },

        isExpired: function(expirationDate) {
            // returns true if already expired
            var expirationTime = new Date(expirationDate).getTime();
            var now = new Date().getTime();
            return now >= expirationTime;
        },


        shouldShowExamLink: function(status) {
            // show the exam link if the user should retry onboarding, or if they haven't submitted the exam
            var NO_SHOW_STATES = ['submitted', 'second_review_required', 'verified'];
            return !NO_SHOW_STATES.includes(status);
        },

        render: function() {
            var statusText = {};
            var releaseDate;
            var now = new Date();
            var data = this.model.toJSON();
            if (this.template) {
                if (data.expiration_date && this.isExpired(data.expiration_date)) {
                    this.status = 'expired';
                } else if (data.expiration_date && this.isExpiringSoon(data.expiration_date)) {
                    this.status = 'expiring_soon';
                } else {
                    this.status = data.onboarding_status;
                }
                statusText = this.getExamAttemptText(this.status);
                releaseDate = new Date(data.onboarding_release_date);
                data = {
                    onboardingStatus: this.status,
                    onboardingStatusText: statusText.status,
                    onboardingMessage: statusText.message,
                    onboardingDetail: statusText.detail,
                    showOnboardingReminder: !['verified', 'other_course_approved'].includes(data.onboarding_status),
                    onboardingNotReleased: releaseDate > now,
                    onboardingPastDue: data.onboarding_past_due,
                    showOnboardingExamLink: this.shouldShowExamLink(data.onboarding_status),
                    onboardingLink: data.onboarding_link,
                    onboardingReleaseDate: releaseDate.toLocaleDateString(),
                    reviewRequirementsUrl: data.review_requirements_url
                };

                $(this.el).html(this.template(data));
            }
        },

        loadTemplateData: function() {
            var self = this;
            // only load data/render if course_id is defined
            if (self.course_id) {
                $.ajax({url: self.template_url, dataType: 'html'})
                    .done(function(templateData) {
                        self.template = _.template(templateData);
                        self.hydrate();
                    });
            }
        },

        hydrate: function() {
            var self = this;
            self.model.fetch({
                success: function() {
                    self.render();
                    self.updateCss();
                }
            });
        }
    });
    this.edx.courseware.proctored_exam.ProctoredExamInfo = edx.courseware.proctored_exam.ProctoredExamInfo;
}).call(this, Backbone, $, _, gettext);
