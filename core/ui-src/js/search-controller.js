angular
    .module('nzbhydraApp')
    .controller('SearchController', SearchController);

function SearchController($scope, $http, $stateParams, $state, $uibModal, $timeout, $sce, growl, SearchService, focus, ConfigService, HydraAuthService, CategoriesService, $element, SearchHistoryService) {

    function getNumberOrUndefined(number) {
        if (_.isUndefined(number) || _.isNaN(number) || number === "") {
            return undefined;
        }
        number = parseInt(number);
        if (_.isNumber(number)) {
            return number;
        } else {
            return undefined;
        }
    }

    var searchRequestId = 0;
    var isSearchCancelled = false;

    //Fill the form with the search values we got from the state params (so that their values are the same as in the current url)
    $scope.mode = $stateParams.mode;
    $scope.query = "";
    $scope.categories = _.filter(CategoriesService.getAllCategories(), function (c) {
        return c.mayBeSelected && !(c.ignoreResultsFrom === "INTERNAL" || c.ignoreResultsFrom === "BOTH");
    });
    if (angular.isDefined($stateParams.category) && $stateParams.category) {
        $scope.category = CategoriesService.getByName($stateParams.category);
    } else {
        $scope.category = CategoriesService.getDefault();
    }
    $scope.category = (_.isUndefined($stateParams.category) || $stateParams.category === "") ? CategoriesService.getDefault() : CategoriesService.getByName($stateParams.category);
    $scope.tmdbId = $stateParams.tmdbid;
    $scope.tvdbId = $stateParams.tvdbid;
    $scope.imdbId = $stateParams.imdbid;
    $scope.tvmazeId = $stateParams.tvmazeid;
    $scope.rid = $stateParams.rid;
    $scope.title = $stateParams.title;
    $scope.season = $stateParams.season;
    $scope.episode = $stateParams.episode;
    $scope.query = $stateParams.query;
    $scope.minsize = getNumberOrUndefined($stateParams.minsize);
    $scope.maxsize = getNumberOrUndefined($stateParams.maxsize);
    $scope.minage = getNumberOrUndefined($stateParams.minage);
    $scope.maxage = getNumberOrUndefined($stateParams.maxage);
    if (!_.isUndefined($scope.title) && _.isUndefined($scope.query)) {
        //$scope.query = $scope.title;
    }
    if (!angular.isUndefined($stateParams.indexers)) {
        $scope.indexers = decodeURIComponent($stateParams.indexers).split("|");
    }

    $scope.showIndexers = {};

    $scope.searchHistory = [];

    var safeConfig = ConfigService.getSafe();
    $scope.showIndexerSelection = HydraAuthService.getUserInfos().showIndexerSelection;


    $scope.typeAheadWait = 300;
    $scope.selectedItem = "";
    $scope.autocompleteLoading = false;
    $scope.isAskById = $scope.category.searchType === "TVSEARCH" || $scope.category.searchType === "MOVIE";
    $scope.isById = {value: true}; //If true the user wants to search by id so we enable autosearch. Was unable to achieve this using a simple boolean
    $scope.availableIndexers = [];
    $scope.selectedIndexers = [];
    $scope.autocompleteClass = "autocompletePosterMovies";

    $scope.toggleCategory = function (searchCategory) {
        $scope.category = searchCategory;

        //Show checkbox to ask if the user wants to search by ID (using autocomplete)
        $scope.isAskById = $scope.category.searchType === "TVSEARCH" || $scope.category.searchType === "MOVIE";

        focus('searchfield');

        //Hacky way of triggering the autocomplete loading
        var searchModel = $element.find("#searchfield").controller("ngModel");
        if (angular.isDefined(searchModel.$viewValue)) {
            searchModel.$setViewValue(searchModel.$viewValue + " ");
        }

        if (safeConfig.searching.enableCategorySizes) {
            var min = searchCategory.minSizePreset;
            var max = searchCategory.maxSizePreset;
            if (_.isNumber(min)) {
                $scope.minsize = min;
            } else {
                $scope.minsize = "";
            }
            if (_.isNumber(max)) {
                $scope.maxsize = max;
            } else {
                $scope.maxsize = "";
            }
        }

        $scope.availableIndexers = getAvailableIndexers();
    };


    // Any function returning a promise object can be used to load values asynchronously
    $scope.getAutocomplete = function (val) {
        $scope.autocompleteLoading = true;
        //Expected model returned from API:
        //label: What to show in the results
        //title: Will be used for file search
        //value: Will be used as extraInfo (ttid oder tvdb id)
        //poster: url of poster to show

        //Don't use autocomplete if checkbox is disabled
        if (!$scope.isById.value) {
            return {};
        }

        if ($scope.category.searchType === "MOVIE") {
            return $http.get('internalapi/autocomplete/MOVIE/' + val).then(function (response) {
                $scope.autocompleteLoading = false;
                return response.data;
            });
        } else if ($scope.category.searchType === "TVSEARCH") {
            return $http.get('internalapi/autocomplete/TV/' + val).then(function (response) {
                $scope.autocompleteLoading = false;
                return response.data;
            });
        } else {
            return {};
        }
    };

    $scope.startSearch = function () {
        isSearchCancelled = false;
        searchRequestId = Math.round(Math.random() * 999999);
        var modalInstance = $scope.openModal(searchRequestId);

        var indexers = angular.isUndefined($scope.indexers) ? undefined : $scope.indexers.join("|");
        SearchService.search(searchRequestId, $scope.category.name, $scope.query, $scope.tmdbId, $scope.imdbId, $scope.title, $scope.tvdbId, $scope.rid, $scope.season, $scope.episode, $scope.minsize, $scope.maxsize, $scope.minage, $scope.maxage, indexers, $scope.mode).then(function () {
                modalInstance.close();
                if (!isSearchCancelled) {
                    $state.go("root.search.results", {
                        minsize: $scope.minsize,
                        maxsize: $scope.maxsize,
                        minage: $scope.minage,
                        maxage: $scope.maxage
                    }, {
                        inherit: true
                    });
                    $scope.tmdbId = undefined;
                    $scope.imdbId = undefined;
                    $scope.tvdbId = undefined;
                }
            },
            function () {
                modalInstance.close();
            });
    };

    $scope.openModal = function openModal(searchRequestId) {
        return $uibModal.open({
            templateUrl: 'static/html/search-state.html',
            controller: SearchUpdateModalInstanceCtrl,
            size: "md",
            backdrop: "static",
            backdropClass: "waiting-cursor",
            resolve: {
                searchRequestId: function () {
                    return searchRequestId;
                },
                onCancel: function () {
                    function cancel() {
                        isSearchCancelled = true;
                    }

                    return cancel;
                }
            }
        });
    };


    $scope.goToSearchUrl = function () {
        //State params (query parameters) should all be lowercase
        var stateParams = {};
        stateParams.mode = $scope.category.searchType.toLowerCase();
        stateParams.imdbid = $scope.imdbId;
        stateParams.tmdbid = $scope.tmdbId;
        stateParams.tvdbid = $scope.tvdbId;
        stateParams.tvrageid = $scope.tvrageId;
        stateParams.tvmazeid = $scope.tvmazeId;
        stateParams.title = $scope.title;
        stateParams.season = $scope.season;
        stateParams.episode = $scope.episode;
        stateParams.query = $scope.query;
        stateParams.minsize = $scope.minsize;
        stateParams.maxsize = $scope.maxsize;
        stateParams.minage = $scope.minage;
        stateParams.maxage = $scope.maxage;
        stateParams.category = $scope.category.name;
        stateParams.indexers = encodeURIComponent($scope.selectedIndexers.join("|"));
        $state.go("root.search", stateParams, {inherit: false, notify: true, reload: true});
    };

    $scope.repeatSearch = function (request) {
        $state.go("root.search", SearchHistoryService.getStateParamsForRepeatedSearch(request), {inherit: false, notify: true, reload: true});
    };


    $scope.selectAutocompleteItem = function ($item) {
        $scope.selectedItem = $item;
        $scope.title = $item.title;
        if ($item.tmdbId) {
            $scope.tmdbId = $item.tmdbId;
        }
        if ($item.tvdbId) {
            $scope.tvdbId = $item.tvdbId;
        }
        $scope.query = undefined;
        $scope.goToSearchUrl();
    };

    $scope.startQuerySearch = function () {
        if (!$scope.query) {
            growl.error("You didn't enter a query...");
        } else {
            //Reset values because they might've been set from the last search
            $scope.title = undefined;
            $scope.tmdbId = undefined;
            $scope.tvdbId = undefined;
            $scope.season = undefined;
            $scope.episode = undefined;
            $scope.goToSearchUrl();
        }
    };


    $scope.autocompleteActive = function () {
        return $scope.isAskById;
    };

    $scope.seriesSelected = function () {
        return $scope.category.searchType === "TVSEARCH";
    };

    $scope.toggleIndexer = function (indexer) {
        $scope.availableIndexers[indexer.name].activated = !$scope.availableIndexers[indexer.name].activated;
    };


    function isIndexerPreselected(indexer) {
        if (angular.isUndefined($scope.indexers)) {
            return indexer.preselect;
        } else {
            return _.contains($scope.indexers, indexer.name);
        }

    }


    function getAvailableIndexers() {
        var alreadySelected = $scope.selectedIndexers;
        var previouslyAvailable = _.pluck($scope.availableIndexers, "name");
        $scope.selectedIndexers = [];
        var availableIndexersList = _.chain(safeConfig.indexers).filter(function (indexer) {
            return indexer.enabled && indexer.showOnSearch && (angular.isUndefined(indexer.categories) || indexer.categories.length === 0 || $scope.category.name.toLowerCase() === "all" || indexer.categories.indexOf($scope.category.name) > -1);
        }).sortBy(function (indexer) {
            return indexer.name.toLowerCase();
        })
            .map(function (indexer) {
                return {name: indexer.name, activated: isIndexerPreselected(indexer), categories: indexer.categories};
            }).value();
        _.forEach(availableIndexersList, function (x) {
            var deselectedBefore = (_.indexOf(previouslyAvailable, x.name) > -1 && _.indexOf(alreadySelected, x.name) === -1);
            var selectedBefore = (_.indexOf(previouslyAvailable, x.name) > -1 && _.indexOf(alreadySelected, x.name) > -1);
            if ((x.activated && !deselectedBefore) || selectedBefore) {
                $scope.selectedIndexers.push(x.name);
            }
        });
        return availableIndexersList;
    }


    $scope.toggleAllIndexers = function () {
        _.forEach($scope.availableIndexers, function (x) {
            var index = _.indexOf($scope.selectedIndexers, x.name);
            if (index === -1) {
                $scope.selectedIndexers.push(x.name);
            } else {
                $scope.selectedIndexers.splice(index, 1);
            }
        });
    };

    $scope.formatRequest = function (request) {
        return $sce.trustAsHtml(SearchHistoryService.formatRequest(request, false, true, true, true));
    };

    $scope.availableIndexers = getAvailableIndexers();


    function getAndSetSearchRequests() {
        SearchHistoryService.getSearchHistoryForSearching().success(function (data) {
            $scope.searchHistory = data;
        });
    }

    if ($scope.mode) {
        $scope.startSearch();
    } else {
        //Getting the search history only makes sense when we're not currently searching
        getAndSetSearchRequests();
    }

    $scope.$on("searchResultsShown", function () {
        getAndSetSearchRequests();
    });


}

angular
    .module('nzbhydraApp')
    .controller('SearchUpdateModalInstanceCtrl', SearchUpdateModalInstanceCtrl);

function SearchUpdateModalInstanceCtrl($scope, $interval, SearchService, $uibModalInstance, searchRequestId, onCancel) {

    var updateSearchMessagesInterval = undefined;
    $scope.messages = undefined;
    $scope.indexerSelectionFinished = false;
    $scope.indexersSelected = 0;
    $scope.indexersFinished = 0;

    updateSearchMessagesInterval = $interval(function () {
        SearchService.getSearchState(searchRequestId).then(function (data) {
                $scope.messages = data.data.messages;
                $scope.indexerSelectionFinished = data.data.indexerSelectionFinished;
                $scope.indexersSelected = data.data.indexersSelected;
                $scope.indexersFinished = data.data.indexersFinished;
            },
            function () {
                $interval.cancel(updateSearchMessagesInterval);
            }
        );
    }, 500);

    $scope.cancelSearch = function () {
        if (angular.isDefined(updateSearchMessagesInterval)) {
            $interval.cancel(updateSearchMessagesInterval);
        }
        onCancel();
        $uibModalInstance.dismiss();
    };


    $scope.$on('$destroy', function () {
        if (angular.isDefined(updateSearchMessagesInterval)) {
            $interval.cancel(updateSearchMessagesInterval);
        }
    });


}
