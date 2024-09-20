edx = edx || {};

(function(Backbone, $, _, gettext) {
    'use strict';

    var viewHelper, onboardingStatuses, onboardingProfileAPIStatuses, statusAndModeReadableFormat;
    edx.instructor_dashboard = edx.instructor_dashboard || {};
    edx.instructor_dashboard.proctoring = edx.instructor_dashboard.proctoring || {};
    onboardingStatuses = [
        'not_started',
        'setup_started',
        'onboarding_started',
        'other_course_approved',
        'submitted',
        'verified',
        'rejected',
        'error'
    ];
    onboardingProfileAPIStatuses = [
        'not_started',
        'other_course_approved',
        'submitted',
        'verified',
        'rejected',
        'expired'
    ];
    statusAndModeReadableFormat = {
        // Onboarding statuses
        not_started: gettext('未开始'),
        setup_started: gettext('设置已开始'),
        onboarding_started: gettext('入职已开始'),
        other_course_approved: gettext('已在其他课程中通过'),
        started: gettext('已开始'),
        submitted: gettext('已提交'),
        verified: gettext('已验证'),
        rejected: gettext('已拒绝'),
        error: gettext('错误'),
        expired: gettext('已过期'),
        // TODO: remove as part of MST-745
        onboarding_reset_past_due: gettext('由于考试过期，入职重置失败'),
        // Enrollment modes (Note: 'verified' is both a status and enrollment mode)
        audit: gettext('旁听'),
        honor: gettext('荣誉'),
        professional: gettext('专业'),
        'no-id-professional': gettext('无身份验证专业课程'),
        credit: gettext('学分'),
        masters: gettext('硕士'),
        'executive-education': gettext('高管教育课程')
    };
    viewHelper = {
        // getDateFormat: function(date) {
        //     if (date) {
        //         return new Date(date).toString('MMM dd, yyyy h:mmtt');
        //     } else {
        //         return '---';
        //     }
        // },
        getDateFormat: function(date) {
            if (date) {
                const options = {
                    year: 'numeric',
                    month: 'long', // 'long' 会返回完整的月份名称，如“九月”
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false  // 24小时制
                };
                return new Date(date).toLocaleDateString('zh-CN', options) + ' ' + new Date(date).toLocaleTimeString('zh-CN', options);
            } else {
                return '---';
            }
        },
        getReadableString: function(str) {
            if (str in statusAndModeReadableFormat) {
                return statusAndModeReadableFormat[str];
            }
            return str;
        }
    };
    edx.instructor_dashboard.proctoring.ProctoredExamOnboardingView = Backbone.View.extend({
        initialize: function() {
            this.setElement($('.student-onboarding-status-container'));
            this.collection = new edx.instructor_dashboard.proctoring.ProctoredExamOnboardingCollection();
            this.templateUrl = '/static/proctoring/templates/student-onboarding-status.underscore';
            this.courseId = this.$el.data('course-id');
            this.template = null;

            this.initialUrl = this.collection.url;
            this.collection.url = this.initialUrl + this.courseId;
            this.inSearchMode = false;
            this.searchText = '';
            this.filters = [];
            this.currentPage = 1;

            /* re-render if the model changes */
            this.listenTo(this.collection, 'change', this.collectionChanged);

            /* Load the static template for rendering. */
            this.loadTemplateData();
        },
        events: {
            'click .search-onboarding > span.search': 'searchItems',
            'click .search-onboarding > span.clear-search': 'clearSearch',
            'submit .filter-form': 'filterItems',
            'click .clear-filters': 'clearFilters',
            'click li > a.target-link': 'getPaginatedItems'
        },
        searchItems: function(event) {
            var $searchIcon, $spinner;
            var searchText = $('#search_onboarding_id').val();
            if (searchText !== '') {
                this.inSearchMode = true;
                this.searchText = searchText;
                this.currentPage = 1;
                this.collection.url = this.constructUrl();
                $searchIcon = $(document.getElementById('onboarding-search-indicator'));
                $searchIcon.addClass('hidden');
                $spinner = $(document.getElementById('onboarding-loading-indicator'));
                $spinner.removeClass('hidden');
                this.hydrate();
                event.stopPropagation();
                event.preventDefault();
            }
        },
        clearSearch: function(event) {
            this.inSearchMode = false;
            this.searchText = '';
            this.currentPage = 1;
            this.collection.url = this.constructUrl();
            this.hydrate();
            event.stopPropagation();
            event.preventDefault();
        },
        filterItems: function(event) {
            var $checkboxes = $('.status-checkboxes li input').get();
            var filters = [];
            $checkboxes.forEach(function(checkbox) {
                if (checkbox.checked) {
                    filters.push(checkbox.value);
                }
            });
            this.filters = filters;
            // return to the first page and rerender the view
            this.currentPage = 1;
            this.collection.url = this.constructUrl();
            this.hydrate();
            event.stopPropagation();
            event.preventDefault();
        },
        clearFilters: function(event) {
            this.filters = [];
            this.currentPage = 1;
            this.collection.url = this.constructUrl();
            this.hydrate();
            event.stopPropagation();
            event.preventDefault();
        },
        constructUrl: function(page) {
            var url;
            page = typeof page !== 'undefined' ? page : null; // eslint-disable-line no-param-reassign
            // if the page has changed, update the current page
            if (page) {
                this.currentPage = page;
            }
            url = this.initialUrl + this.courseId + '?page=' + this.currentPage;
            if (this.searchText) {
                url = url + '&text_search=' + this.searchText;
            }
            if (this.filters.length > 0) {
                url += '&statuses=';
                // creates a string of onboarding statuses separated by ','
                this.filters.forEach(function(filter, i) {
                    if (i > 0) {
                        url += ',';
                    }
                    url += filter;
                });
            }
            return url;
        },
        getPaginatedItems: function(event) {
            var $target = $(event.currentTarget);
            var page = Number($target.data('page-number'));
            this.collection.url = this.constructUrl(page);
            this.hydrate();
            event.stopPropagation();
            event.preventDefault();
        },
        loadTemplateData: function() {
            var self = this;
            $.ajax({url: self.templateUrl, dataType: 'html'})
                .done(function(templateData) {
                    self.template = _.template(templateData);
                    self.hydrate();
                });
        },
        hydrate: function() {
            /* This function will load the bound collection */

            /* add and remove a class when we do the initial loading */
            /* we might - at some point - add a visual element to the */
            /* loading, like a spinner */
            var self = this;
            self.collection.fetch({
                success: function() {
                    var $searchIcon, $spinner;
                    self.render();
                    $spinner = $(document.getElementById('onboarding-loading-indicator'));
                    $spinner.addClass('hidden');
                    $searchIcon = $(document.getElementById('onboarding-search-indicator'));
                    $searchIcon.removeClass('hidden');
                },
                error: function(unused, response) {
                    var data, $searchIcon, $spinner, $errorResponse, $onboardingPanel;

                    // in the case that there is no onboarding data, we
                    // still want the view to render
                    self.render();

                    try {
                        data = $.parseJSON(response.responseText);
                    } catch (error) {
                        data = {
                            detail: 'An unexpected error occured. Please try again later.'
                        };
                    }

                    if (data.detail) {
                        $errorResponse = $('#error-response');
                        $errorResponse.html(data.detail);
                        $onboardingPanel = $('.onboarding-status-content');
                        $onboardingPanel.hide();
                    }

                    $spinner = $(document.getElementById('onboarding-loading-indicator'));
                    $spinner.addClass('hidden');
                    $searchIcon = $(document.getElementById('onboarding-search-indicator'));
                    $searchIcon.removeClass('hidden');
                }
            });
        },
        collectionChanged: function() {
            this.hydrate();
        },
        render: function() {
            var data, dataJson, html, startPage, endPage, statuses;

            if (this.template !== null) {
                data = {
                    previousPage: null,
                    nextPage: null,
                    currentPage: 1,
                    onboardingItems: [],
                    onboardingStatuses: onboardingStatuses,
                    inSearchMode: this.inSearchMode,
                    searchText: this.searchText,
                    filters: this.filters,
                    constructUrl: this.constructUrl,
                    startPage: 1,
                    endPage: 1
                };

                dataJson = this.collection.toJSON()[0];
                if (dataJson) {
                    // calculate which pages ranges to display
                    // show no more than 5 pages at the same time
                    if (this.currentPage > 3) {
                        startPage = this.currentPage - 2;
                    } else {
                        startPage = 1;
                    }

                    endPage = startPage + 4;

                    if (endPage > dataJson.num_pages) {
                        endPage = dataJson.num_pages;
                    }

                    statuses = dataJson.use_onboarding_profile_api ? onboardingProfileAPIStatuses : onboardingStatuses;
                    data = {
                        previousPage: dataJson.previous,
                        nextPage: dataJson.next,
                        currentPage: this.currentPage,
                        onboardingItems: dataJson.results,
                        onboardingStatuses: statuses,
                        inSearchMode: this.inSearchMode,
                        searchText: this.searchText,
                        filters: this.filters,
                        constructUrl: this.constructUrl,
                        startPage: startPage,
                        endPage: endPage
                    };
                }

                _.extend(data, viewHelper);
                html = this.template(data);
                this.$el.html(html);
            }
        }
    });
    this.edx.instructor_dashboard.proctoring.ProctoredExamOnboardingView =
      edx.instructor_dashboard.proctoring.ProctoredExamOnboardingView;
}).call(this, Backbone, $, _, gettext);
