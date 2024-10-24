// Copyright (c) 2022 Siemens
/* global CKEDITOR */

/**
 * @module js/Arm0RequirementQualityService
 */
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';
import cdm from 'soa/kernel/clientDataModel';
import commandSvc from 'js/command.service';
import cfgSvc from 'js/configurationService';
import eventBus from 'js/eventBus';
import $ from 'jquery';
import localStorage from 'js/localStorage';
import _ from 'lodash';
import ckeditorOperations from 'js/ckeditorOperations';
import browserUtils from 'js/browserUtils';
var exports = {};

var _qualityDataResponse;
var _editor_id;
var CalQualityPromise = null;
var REUSE_WEB_SERVICE_PATH = '';
var _reConnecting = false;
var previousObject;

var _getReuseWebServicePath = function( data ) {
    if( appCtxSvc.ctx.preferences.AWC_REQ_Reuse_URL ) {
        var reuseWebServicePath = appCtxSvc.ctx.preferences.AWC_REQ_Reuse_URL[ 0 ];
        if( !_isEmptyOrSpaces( reuseWebServicePath ) ) {
            if( !reuseWebServicePath.endsWith( '/' ) ) {
                reuseWebServicePath += '/';
            }
            return reuseWebServicePath += 'trcapi.asmx';
        }
    }
};

var _isEmptyOrSpaces = function( str ) {
    return str === undefined || str.match( /^ *$/ ) !== null;
};

export let getConnectWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/Connect';
};

export let getInitProjectWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/InitProject';
};

export let getInitBlockWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/InitBlock';
};

export let getHasBlockMetricsWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/HasBlockMetrics';
};

export let getGetMetricsTemplateBlockWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/GetMetricsTemplateBlock';
};

export let getSetMetricsTemplateBlockWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/SetMetricsTemplateBlock';
};

export let getInitRequirementWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/InitRequirement';
};

export let getCalculateQualityWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/CalculateQuality';
};

export let getAuthorTextAndCalculateQualityWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/AuthorTextAndCalculateQuality';
};

export let getGetPatternGroupsWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/GetPatternGroups';
};

export let getGetCorrectnessReportWebServicePath = function() {
    return REUSE_WEB_SERVICE_PATH + '/GetCorrectnessReportForCurrentModule';
};

/**
 * @param {Object} data - ViewModel object data
 * @param {String} option - Requirement OR Specification; 'Requirement' option will calculare & show quality panel and 'Specification' option will download quality report
 */
export let prePopulateDataForReuseAPI = function( data, option ) {
    eventBus.publish( 'requirementDocumentation.closeSplitPanel' );
    REUSE_WEB_SERVICE_PATH = _getReuseWebServicePath( data );
    if( !REUSE_WEB_SERVICE_PATH ) {
        throw '\'AWC_REQ_Reuse_URL\' incorrect preference value ';
    }
    _getLoginInfo( data );
    var productInfo = exports.getProductAndTopElementInfo();

    data.ProductInfo = {
        projectLocation: '/' + productInfo.product_name,
        projectName: productInfo.product_name,
        projectCode: productInfo.product_id,

        blockCode: productInfo.product_id,
        blockName: productInfo.product_name,
        blockLocation: '/' + productInfo.product_name + '/' + productInfo.product_name,

        absoluteNumber: productInfo.requirement_id,
        url: '/' + productInfo.product_name + '/' + productInfo.product_name + '/' + productInfo.requirement_name,
        requirementHeader: productInfo.requirement_name
    };

    if( option ) {
        data.CALCULATE_QUALITY = option === 'Requirement';
    }

    var existingSessionId = exports.getReuseSessionFromLocalStorage( data );
    if( existingSessionId && existingSessionId.sessionId ) {
        data.ReuseSessionId = existingSessionId.sessionId;
    } else {
        data.ReuseSessionId = undefined;
    }

    // Add API URLs to commandsViewModel data, instead of calling functions from commandsviewModel to get URL
    data.ConnectWebServicePath = exports.getConnectWebServicePath();
    data.InitProjectWebServicePath = exports.getInitProjectWebServicePath();
    data.InitBlockWebServicePath = exports.getInitBlockWebServicePath();
    data.HasBlockMetricsWebServicePath = exports.getHasBlockMetricsWebServicePath();
    data.GetMetricsTemplateBlockWebServicePath = exports.getGetMetricsTemplateBlockWebServicePath();
    data.SetMetricsTemplateBlockWebServicePath = exports.getSetMetricsTemplateBlockWebServicePath();
    data.InitRequirementWebServicePath = exports.getInitRequirementWebServicePath();
};

/**
 *Function to return promise so that intesslise UI will wait till TRC service returns the response
 * @returns {Promise} the promise that will resolve on getting next possible terms from TRC response
 */
export let getCalQualityPromise = function() {
    CalQualityPromise = AwPromiseService.instance.defer();
    return CalQualityPromise.promise;
};

export let showReqQualityData = function( data, commandContext ) {
    ckeditorOperations.showReqQualityData( data, _reConnecting, commandContext );
    _reConnecting = false;
    setTimeout( () => {
        eventBus.publish( 'requirementsEditor.resizeEditor' );
    }, 100 );
};

export let GetPatternGroups = function( data ) {
    if( data.eventMap && data.eventMap[ 'Arm0ShowQualityMetricData.reveal' ] ) {
        data.ReuseSessionId = data.eventMap[ 'Arm0ShowQualityMetricData.reveal' ].ReuseSessionId;
    } else if( localStorage.get( 'ReuseAPISessionInfo' ) ) {
        data.ReuseSessionId = JSON.parse( localStorage.get( 'ReuseAPISessionInfo' ) ).sessionId;
    }
    var defer = AwPromiseService.instance.defer();
    $.ajax( {
        url: REUSE_WEB_SERVICE_PATH + '/GetPatternGroups',
        data: JSON.stringify( { sessionId: data.ReuseSessionId } ),
        async: false,
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json; charset=utf-8',
        success: function( xml ) {
            var patternGroups = [];

            var groups = xml.d.AuthoringPatternGroups;
            var nullObjectAdded = false;
            for( var i = 0; i < groups.length; i++ ) {
                var obj = {
                    propDisplayValue: groups[ i ].Name,
                    propInternalValue: groups[ i ].Code ? groups[ i ].Code.toString() : undefined
                };

                nullObjectAdded = !nullObjectAdded ? obj.propInternalValue === '-1' : nullObjectAdded;

                patternGroups.push( obj );
            }
            // If null object is not already added, add it at the start of list
            if( !nullObjectAdded ) {
                var temp = patternGroups;
                var nullObject = {
                    propDisplayValue: '',
                    propInternalValue: '-1'
                };
                patternGroups = [];
                patternGroups.push( nullObject );
                patternGroups = patternGroups.concat( temp );
            }
            var patterns = {
                patternGroups:patternGroups,
                ReuseSessionId:data.ReuseSessionId
            };
            defer.resolve( patterns );
        }
    } );
    return defer.promise;
};

export let GetPatternsByPatternGroup = function( data ) {
    if( data.eventMap && data.eventMap[ 'Arm0ShowQualityMetricData.reveal' ] ) {
        data.ReuseSessionId = data.eventMap[ 'Arm0ShowQualityMetricData.reveal' ].ReuseSessionId;
    } else if( localStorage.get( 'ReuseAPISessionInfo' ) ) {
        data.ReuseSessionId = JSON.parse( localStorage.get( 'ReuseAPISessionInfo' ) ).sessionId;
    }
    var defer = AwPromiseService.instance.defer();
    if( data.patternGroupCombo.dbValue !== '-1' ) {
        $.ajax( {
            url: REUSE_WEB_SERVICE_PATH + '/GetPatternsByPatternGroup',
            data: JSON.stringify( {
                sessionId: data.ReuseSessionId,
                code: data.patternGroupCombo.dbValue
            } ),
            type: 'POST',
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            success: function( xml ) {
                var patternList = [];

                var groups = xml.d.AuthoringPattern;
                var nullObjectAdded = false;
                for( var i = 1; i < groups.length; i++ ) {
                    var obj = {
                        propDisplayValue: groups[ i ].Name,
                        propInternalValue: groups[ i ].Code ? groups[ i ].Code.toString() : undefined,
                        Examples: []
                    };

                    if( groups[ i ].ExamplesAsArray ) {
                        for( var j = 0; j < groups[ i ].ExamplesAsArray.length; j++ ) {
                            if( groups[ i ].Examples[ j ] ) {
                                obj.Examples.push( groups[ i ].ExamplesAsArray[ j ].toString() );
                            }
                        }
                    }
                    nullObjectAdded = !nullObjectAdded ? obj.propInternalValue === '-1' : nullObjectAdded;
                    patternList.push( obj );
                }
                // If null object is not already added, add it at the start of list
                if( !nullObjectAdded ) {
                    var temp = patternList;
                    var nullObject = {
                        propDisplayValue: '',
                        propInternalValue: '-1'
                    };
                    patternList = [];
                    patternList.push( nullObject );
                    patternList = patternList.concat( temp );
                }

                defer.resolve( patternList );
            }

        } );
    }
    return defer.promise;
};

var _updateCKEditorInstance = function( qualityShown, calculateInProcess ) {
    var ckEditor = CKEDITOR.instances[ _editor_id ];
    if( ckEditor && qualityShown ) {
        ckEditor.RAT = {};
        ckEditor.RAT.SHOW_QUALITY_VISIBLE = qualityShown;
        ckEditor.RAT.CALCULATE_QUALITY_IN_PROCESS = calculateInProcess;
    } else if( ckEditor ) {
        ckEditor.RAT = undefined;
    }
};

export let updateNextPossibleTerms = function( patternGroupCode, nextPossibleTerms, matchingState ) {
    if ( patternGroupCode !== '-1' && nextPossibleTerms && nextPossibleTerms.length > 0 &&
    matchingState && matchingState !== 'NotMatched' ) {
        //nextPossibleTerms = nextPossibleTerms[0].children;
        var autoCompleteItems = [];
        var i = 0;
        for ( i = 0; i < nextPossibleTerms.length; i++ ) {
            var option = {};
            option.id = String( ' ' + nextPossibleTerms[i] );
            autoCompleteItems.push( option );
        }
        if( CalQualityPromise ) {
            CalQualityPromise.resolve( autoCompleteItems );
        }
    }else {
        if( CalQualityPromise ) {
            CalQualityPromise.resolve( [] );
        }
    }
};

export let getNextElementTerms = function( callback ) {
    var promise = getCalQualityPromise();
    promise.then( function( nextPossibleTerms ) {
        if( callback ) {
            callback( nextPossibleTerms );
        }
    } );
};

/**
 *
 * @param {Object} xml the xml object
 * @param {Array} row the rows to show in table
 */
function updateMatchedPath( xml, rows ) {
    var i;
    var found = false;
    var matchedPath = '';
    var matchinState = _getMatchingState( xml );
    for( i = 0; i < rows.length; i++ ) {
        var row = rows[i];
        if( matchinState && ( matchinState === 'Matched' || matchinState === 'AfterOrBeforeMatch' ) ) {
            matchedPath = xml.d.AuthoringOutput.MatchedPath;
            var trimmedMatchedValue = matchedPath.trim();
            var matchedValue =  trimmedMatchedValue.substring( 0, trimmedMatchedValue.length - 1 );
            if( row.ShortestPathForSelectedPattern.trim() === matchedValue.trim() ) {
                row.matchedPath = row.ShortestPathForSelectedPattern;
                row.nextValidRestriction = '';
                row.restOfShortestPathForSelectedPattern = '';
                found = true;
            }
        }
    }
    if( !found && matchedPath.length > 0 ) {
        var matchedRow = {};
        matchedRow.matchedPath = matchedPath;
        matchedRow.nextValidRestriction = '';
        matchedRow.restOfShortestPathForSelectedPattern = '';
        rows.push( matchedRow );
    }
}

export let setQualityRuleSelection = function( data, metricId ) {
    var dataProvider = data.dataProviders.metricAllDataProvider;
    var selModel = dataProvider.selectionModel;
    var vmObjects = dataProvider.viewModelCollection.loadedVMObjects;
    var objToSelect = [];
    for( var object in vmObjects ) {
        if( vmObjects[ object ].props && vmObjects[ object ].props.metricId  ) {
            if( metricId === vmObjects[ object ].props.metricId.value ) {
                objToSelect.push( vmObjects[ object ] );
                break;
            }
        }
    }
    if( objToSelect.length > 0 ) {
        if( !previousObject ) {
            previousObject = objToSelect[0];
        } else if( objToSelect[0] === previousObject ) {
            // eventBus.publish( 'metricAllDataProvider.selectionChangeEvent', { selectedObjects: objToSelect } );
            //selModel.setSelection();
            selModel.setSelection( objToSelect );
        } else {
            selModel.setSelection( objToSelect );
        }
    }
};

export let CalculateQuality = function( data ) {
    var defer = AwPromiseService.instance.defer();
    if( data.eventMap && data.eventMap[ 'Arm0ShowQualityMetricData.reveal' ] ) {
        data.ReuseSessionId = data.eventMap[ 'Arm0ShowQualityMetricData.reveal' ].ReuseSessionId;
    } else if( localStorage.get( 'ReuseAPISessionInfo' ) ) {
        data.ReuseSessionId = JSON.parse( localStorage.get( 'ReuseAPISessionInfo' ) ).sessionId;
    }
    ckeditorOperations.updateCKEditorInstance( true, true );

    var patternCode = data.patternCombo ? data.patternCombo.dbValue : -1;
    var patternGroupCode = data.patternGroupCombo ? data.patternGroupCombo.dbValue : -1;
    if( patternCode === '-1' ) {
        patternCode = '-2';
    }
    var singleReqText = ckeditorOperations.getRequirementContent( data );
    var singleReqHeader = ckeditorOperations.getRequirementHeader();

    var re = new RegExp( String.fromCharCode( 160 ), 'g' );
    singleReqText = singleReqText.replace( re, ' ' );

    var method = '/CalculateQuality';
    var reqData = {
        sessionId: data.ReuseSessionId,
        headerText: singleReqHeader,
        descriptionText: singleReqText
    };
    if( patternGroupCode && patternGroupCode !== '-1' ) {
        method = '/AuthorTextAndCalculateQuality';
        reqData = {
            sessionId: data.ReuseSessionId,
            headerText: singleReqHeader,
            descriptionText: singleReqText,
            selectedAuthoringPatternGroupCode: patternGroupCode,
            selectedAuthoringPatternCode: patternCode
        };
    }

    reqData = JSON.stringify( reqData );

    $.ajax( {

        url: REUSE_WEB_SERVICE_PATH + method,
        data: reqData,
        type: 'POST',
        dataType: 'json',
        async: true,
        contentType: 'application/json; charset=utf-8',
        success: function( xml ) {
            if( xml.d.Success ) {
                if( patternGroupCode !== '-1' && _getMatchingState( xml ) !== undefined ) {
                    let nextPossibleTerms = xml.d.AuthoringOutput.NextPossibleTerms;
                    let nextPossibleElements = xml.d.AuthoringOutput.NextPossibleElements;

                    updateNextPossibleTerms( patternGroupCode, nextPossibleTerms, _getMatchingState( xml ) );
                    var itPosibleElements = 0;
                    var itMatching = 0;
                    var row = {};

                    var matchingPatternsStructure = [];

                    if( nextPossibleElements && nextPossibleElements.length > 0 ) {
                        // nextPossibleElements = nextPossibleElements[ 0 ].children;

                        for( itPosibleElements = 0; itPosibleElements < nextPossibleElements.length; itPosibleElements++ ) {
                            row = {};
                            var currentMatchedPath = nextPossibleElements[ itPosibleElements ].MatchedPath;
                            if( currentMatchedPath ) {
                                row.matchedPath = currentMatchedPath;
                            }
                            row.nextValidRestriction = nextPossibleElements[ itPosibleElements ].NextValidRestriction;
                            row.ShortestPathForSelectedPattern = nextPossibleElements[ itPosibleElements ].ShortestPathForSelectedPattern.trim();
                            if( nextPossibleElements[ itPosibleElements ].RestOfShortestPathForSelectedPattern ) {
                                row.restOfShortestPathForSelectedPattern = nextPossibleElements[ itPosibleElements ].RestOfShortestPathForSelectedPattern;
                            }
                            matchingPatternsStructure.push( row );
                        }
                        updateMatchedPath( xml, matchingPatternsStructure );
                    }

                    var matched_info = xml.d.AuthoringOutput.MatchedPatterns;
                    var matching_info = xml.d.AuthoringOutput.MatchingPatterns;

                    var matchingPatternsState = [];

                    if( matched_info && matched_info.length > 0 ) {
                        for( itMatching = 0; itMatching < matched_info.length; itMatching++ ) {
                            row = {};
                            row.status = 'Matched';
                            row.weight = matched_info[ itMatching ].Weight ? matched_info[ itMatching ].Weight.toString() : undefined;
                            row.patternName = matched_info[ itMatching ].Name;

                            matchingPatternsState.push( row );
                        }
                    }

                    if( matching_info && matching_info.length > 0 ) {
                        for( itMatching = 0; itMatching < matching_info.length; itMatching++ ) {
                            row = {};
                            row.status = 'Matching';
                            row.weight = matching_info[ itMatching ].Weight ? matching_info[ itMatching ].Weight.toString() : undefined;
                            row.patternName = matching_info[ itMatching ].Name;

                            matchingPatternsState.push( row );
                        }
                    }
                }

                var metric_array = [];
                var invalid_metric_array = [];

                var globalQualityId = xml.d.QualityOutput ? xml.d.QualityOutput.GlobalQualityId : undefined;
                var FeaturesByMetric = xml.d.QualityOutput ? xml.d.QualityOutput.FeaturesByMetric : xml.d.FeaturesByMetric;
                var itMetrics = 0;
                //for each Metric...
                for( itMetrics = 0; itMetrics < FeaturesByMetric.length; itMetrics++ ) {
                    var metric = FeaturesByMetric[ itMetrics ];

                    row = {};

                    row.summary = metric.Summary;
                    row.metricName = metric.MetricName;
                    row.metricValue = metric.AbsoluteValue_String ? metric.AbsoluteValue_String.toString() : metric.AbsoluteValue_String;
                    row.metricId = metric.MetricPerTypeId ? metric.MetricPerTypeId.toString() : metric.MetricPerTypeId;
                    row.weight = metric.Weight ? metric.Weight.toString() : metric.Weight;
                    row.qualityLevel = metric.QualityLevel ? metric.QualityLevel.toString() : metric.QualityLevel;
                    row.mandatory = metric.AffectsOverallQuality ? metric.AffectsOverallQuality.toString() : metric.AffectsOverallQuality;
                    if( metric.FeaturesAsString ) {
                        row.featuresAsString = metric.FeaturesAsString;
                    }
                    // Find instances from FeaturesAsDoubleDict or FeaturesAsDict
                    var instances = [];
                    var featuresAsDict = undefined;
                    if( metric.FeaturesAsDict && metric.FeaturesAsDict !== null ) {
                        featuresAsDict = metric.FeaturesAsDict;
                    }
                    if( metric.FeaturesAsDoubleDict && metric.FeaturesAsDoubleDict !== null ) {
                        featuresAsDict = metric.FeaturesAsDoubleDict;
                    }
                    if ( featuresAsDict !== undefined ) {
                        for ( var itFeatures = 0; itFeatures < featuresAsDict.length; itFeatures++ ) {
                            var instancesElements = featuresAsDict[itFeatures].Instances ? featuresAsDict[itFeatures].Instances : [];

                            for ( var itInstances = 0; itInstances < instancesElements.length; itInstances++ ) {
                                if( !_contains( instances, instancesElements[itInstances] ) ) {
                                    instances.push( instancesElements[itInstances] );
                                }
                            }
                        }
                    }
                    row.instances = instances;

                    metric_array.push( row );

                    // If low quality
                    if( row.qualityLevel === '2' || row.qualityLevel === '3' ) {
                        invalid_metric_array.push( row );
                    }
                }

                var eventData = {
                    globalQualityId: globalQualityId,
                    metricAll: metric_array,
                    metricInvalid: invalid_metric_array,
                    matchingPatternsStructure: matchingPatternsStructure,
                    matchingPatternsState: matchingPatternsState,
                    matchingPatternsExamples: data.patternComboList ? data.patternComboList.dbValue : -1
                };
                eventBus.publish( 'requirementDocumentation.showQualityData', eventData );
                ckeditorOperations.updateCKEditorInstance( true, false );

                defer.resolve();
            } else {
                // No valid session
                // Disconnect the RAT session if calculateQuality soa is not success and try connecting again

                defer.resolve();
                exports.removeReuseSessionFromLocalStorage();
                //appCtxSvc.unRegisterCtx( 'showRequirementQualityData' );
                _reConnecting = true;
                commandSvc.executeCommand( 'Arm0ShowReqQualityData' );
                ckeditorOperations.updateCKEditorInstance( false, false );
            }
        },
        error: function( data ) {
            exports.removeReuseSessionFromLocalStorage();
            // Error while connecting to reuse API
            appCtxSvc.unRegisterCtx( 'showRequirementQualityData' );
            ckeditorOperations.updateCKEditorInstance( false, false );
            defer.reject( data );
        }
    } );

    return defer.promise;
};

var _getMatchingState = function( xml ) {
    return xml.d.AuthoringOutput.MatchingState;
};

var _contains = function( array, item ) {
    for( var i in array ) {
        if( array[ i ] === item ) {
            return true;
        }
    }
    return false;
};

var _createProp = function( propName, propValue, type, propDisplayName ) {
    return {
        type: type,
        hasLov: false,
        isArray: false,
        displayValue: propValue,
        uiValue: propValue,
        value: propValue,
        propertyName: propName,
        propertyDisplayName: propDisplayName,
        isEnabled: true
    };
};

var _createMetricViewModelObject = function( metric ) {
    var properties = [];
    properties.summary = _createProp( 'summary', metric.summary, 'STRING', 'Summary' );
    properties.metric = _createProp( 'metric', metric.metricName, 'STRING', 'Metric' );
    properties.value = _createProp( 'value', metric.metricValue, 'STRING', 'Value' );
    properties.metricId = _createProp( 'metricId', metric.metricId, 'STRING', 'Metric Id' );
    properties.weight = _createProp( 'weight', metric.weight, 'STRING', 'Weight' );
    properties.qualityCorrectness = _createProp( 'qualityCorrectness', metric.qualityLevel, 'STRING', 'Correctness' );
    properties.qualityStatus = _createProp( 'qualityStatus', metric.qualityLevel, 'STRING', 'Status' );
    properties.mandatory = _createProp( 'mandatory', metric.mandatory ? 'True' : 'False', 'STRING', 'Mandatory' );
    properties.instances = _createProp( 'instances', metric.instances, 'ARRAY', 'Instances' );

    var vmNode = awTableTreeSvc.createViewModelTreeNode();
    vmNode.props = properties;

    return vmNode;
};

var _sortArray = function( array, sortCriteria ) {
    if( sortCriteria && sortCriteria.length > 0 ) {
        var criteria = sortCriteria[ 0 ];
        var sortDirection = criteria.sortDirection;
        var sortColName = criteria.fieldName;

        if( sortDirection === 'ASC' ) {
            array.sort( function( a, b ) {
                if( a.props[ sortColName ].value <= b.props[ sortColName ].value ) {
                    return -1;
                }

                return 1;
            } );
        } else if( sortDirection === 'DESC' ) {
            array.sort( function( a, b ) {
                if( a.props[ sortColName ].value >= b.props[ sortColName ].value ) {
                    return -1;
                }

                return 1;
            } );
        }
    }
    return array;
};

export let filterQualityResultWithSort = function( data, sortCriteria, startIndex ) {
    var metric_array = [];

    var response = _qualityDataResponse;

    if( response ) {
        var FeaturesByMetric = response.metricAll;
        var itMetrics = 0;
        //for each Metric...
        for( itMetrics = 0; itMetrics < FeaturesByMetric.length; itMetrics++ ) {
            var metric = FeaturesByMetric[ itMetrics ];

            metric_array.push( _createMetricViewModelObject( metric ) );
        }
    }

    metric_array = _sortArray( metric_array, sortCriteria );

    var endIndex = startIndex + metric_array.length;

    return metric_array.slice( startIndex, endIndex );
};

export let filterPatternStructureResult = function( data ) {
    var response = _qualityDataResponse;
    var patternStructuresVMObjects = [];
    if( response && response.matchingPatternsStructure ) {
        var patternStructures = response.matchingPatternsStructure;
        var itMetrics = 0;

        //for each Metric...
        for( itMetrics = 0; itMetrics < patternStructures.length; itMetrics++ ) {
            var metric = patternStructures[ itMetrics ];

            var properties = [];

            var matchingPatternsStructure = '';
            if( metric.matchedPath && metric.matchedPath.length > 0 ) {
                matchingPatternsStructure = matchingPatternsStructure + '<span class="aw-richtexteditor-qualityMatchedPath">' + metric.matchedPath + '</span>';
            }
            if( metric.nextValidRestriction && metric.nextValidRestriction.length > 0 ) {
                matchingPatternsStructure = matchingPatternsStructure + '<strong>' + metric.nextValidRestriction + '</strong>';
            }
            if( metric.restOfShortestPathForSelectedPattern && metric.restOfShortestPathForSelectedPattern.length > 0 ) {
                matchingPatternsStructure = matchingPatternsStructure + '<span class="aw-richtexteditor-qualityRestOfShortestPath">' + metric.restOfShortestPathForSelectedPattern + '</span>';
            }

            properties.matchingPatternStructure = _createProp( 'matchingPatternStructure', matchingPatternsStructure, 'STRING', '' );
            // isRichText will render the property value as html
            properties.matchingPatternStructure.isRichText = true;

            var vmNode = awTableTreeSvc.createViewModelTreeNode();
            vmNode.props = properties;

            patternStructuresVMObjects.push( vmNode );
        }
    }

    return patternStructuresVMObjects;
};

export let filterPatternStateResult = function( data ) {
    var response = _qualityDataResponse;
    var patternStateVMObjects = [];
    if( response && response.matchingPatternsState ) {
        var patternState = response.matchingPatternsState;
        var itMetrics = 0;
        //for each Metric...
        for( itMetrics = 0; itMetrics < patternState.length; itMetrics++ ) {
            var metric = patternState[ itMetrics ];

            var properties = [];
            properties.status = _createProp( 'status', metric.status, 'STRING', 'status' );
            properties.weight = _createProp( 'weight', metric.weight, 'STRING', 'weight' );
            properties.patternName = _createProp( 'patternName', metric.patternName, 'STRING', 'patternName' );

            var vmNode = awTableTreeSvc.createViewModelTreeNode();
            vmNode.props = properties;

            patternStateVMObjects.push( vmNode );
        }
    }

    return patternStateVMObjects;
};

export let filterPatternExamplesResult = function( data ) {
    var response = _qualityDataResponse;
    var patternExampesVMObjects = [];
    if( response && response.matchingPatternsExamples ) {
        var patternExamples = response.matchingPatternsExamples;
        var itMetrics = 0;
        //for each Metric...
        for( itMetrics = 0; itMetrics < patternExamples.length; itMetrics++ ) {
            var metric = patternExamples[ itMetrics ];

            if( metric.Examples && ( data.patternCombo.dbValue === '-1' || metric.propInternalValue === data.patternCombo.dbValue ) ) {
                var exampleIndex = 0;
                for( exampleIndex = 0; exampleIndex < metric.Examples.length; exampleIndex++ ) {
                    var example = metric.Examples[ exampleIndex ];
                    var subExamples = example.split( '●' );
                    var itSubExamples = 0;
                    for( itSubExamples = 0; itSubExamples < subExamples.length; itSubExamples++ ) {
                        var text = subExamples[ itSubExamples ].trim();
                        if( text.length > 0 ) {
                            text = text[ 0 ].toUpperCase() + text.slice( 1, text.length );

                            var properties = [];
                            properties.patternName = _createProp( 'patternName', metric.propDisplayValue, 'STRING', 'patternName' );
                            properties.examples = _createProp( 'examples', text, 'STRING', 'examples' );

                            var vmNode = awTableTreeSvc.createViewModelTreeNode();
                            vmNode.props = properties;

                            patternExampesVMObjects.push( vmNode );
                        }
                    }
                }
            }
        }
    }

    return patternExampesVMObjects;
};

export let filterQualityInvalidResultWithSort = function( data, sortCriteria, startIndex ) {
    var response = _qualityDataResponse;

    var invalid_metric_array = [];
    if( response && response.metricInvalid ) {
        var FeaturesByMetric = response.metricInvalid;
        var itMetrics = 0;
        //for each Metric...
        for( itMetrics = 0; itMetrics < FeaturesByMetric.length; itMetrics++ ) {
            var metric = FeaturesByMetric[ itMetrics ];

            invalid_metric_array.push( _createMetricViewModelObject( metric ) );
        }
    }

    invalid_metric_array = _sortArray( invalid_metric_array, sortCriteria );

    var endIndex = startIndex + invalid_metric_array.length;

    data.qualityInvalidMetricResult = invalid_metric_array.slice( startIndex, endIndex );

    return data.qualityInvalidMetricResult;
};

export let qualityRuleSelected = function( data, selectedRule ) {
    ckeditorOperations.qualityRuleSelected( selectedRule );
};

export let clearHighlighting = function() {
    ckeditorOperations.clearHighlighting();
};

export let setQualityDataResponse = function( response ) {
    _editor_id = response.editorId;
    _qualityDataResponse = response.qualityData;
    ckeditorOperations.updateCKEditorInstance( true, false );
    ckeditorOperations.processAfterResponse( response );
};

export let getProductAndTopElementInfo = function( eventData ) {
    var productInfo = {
        product_name: '',
        product_id: '',
        requirement_name: '',
        requirement_id: ''
    };
    if( appCtxSvc.ctx.aceActiveContext && appCtxSvc.ctx.aceActiveContext.context && appCtxSvc.ctx.aceActiveContext.context.productContextInfo &&
        appCtxSvc.ctx.aceActiveContext.context.productContextInfo.props.awb0Product && appCtxSvc.ctx.aceActiveContext.context.topElement ) {
        var awb0ProductUid = appCtxSvc.ctx.aceActiveContext.context.productContextInfo.props.awb0Product.dbValues[ 0 ];
        var product = cdm.getObject( awb0ProductUid );
        var product_name = product.props.object_name.dbValues[ 0 ];
        productInfo.product_name = product_name;
        if( product.props.object_string ) {
            var product_id = product.props.object_string.dbValues[ 0 ].split( '/' )[ 0 ];
            productInfo.product_id = product_id;
        }

        // var topElementUid = appCtxSvc.ctx.aceActiveContext.context.topElement.uid;
        // var topElement = cdm.getObject( topElementUid );
        // var top_element_name = topElement.props.object_name.dbValues[0];
        // var top_element_id = topElement.props.object_string.dbValues[0].split( '/' )[0];
    }

    if( appCtxSvc.ctx.selected.props.awb0ArchetypeId ) {
        productInfo.requirement_id = appCtxSvc.ctx.selected.props.awb0ArchetypeId.dbValues[ 0 ];
    }
    if( appCtxSvc.ctx.selected.props.awb0ArchetypeName ) {
        productInfo.requirement_name = appCtxSvc.ctx.selected.props.awb0ArchetypeName.dbValues[ 0 ];
    }

    if( eventData ) {
        eventData.callback( productInfo );
    } else {
        return productInfo;
    }
};

var _getLoginInfo = function( data ) {
    if( !data.LoginInfo ) {
        var userCellProps = appCtxSvc.ctx.user.props.awp0CellProperties;
        var userName = userCellProps.dbValues[ 0 ].split( ':' )[ 1 ];
        var userId = userCellProps.dbValues[ 1 ].split( ':' )[ 1 ];

        data.LoginInfo = {
            userName: userName,
            userCode: userId,
            companyName: ' ',
            companyCode: ' '
        };

        cfgSvc.getCfg( 'solutionDef' ).then( function( solutionDef ) {
            data.LoginInfo.companyName = solutionDef.brandName;
            data.LoginInfo.companyCode = solutionDef.brandName;
        } );
    }
};

export let getCalculateQualityInput = function( data ) {
    var formData = new FormData();
    formData.append( 'sessionId', data.ReuseSessionId );
    formData.append( 'descriptionText', ckeditorOperations.getRequirementContent() );
    formData.append( 'headerText', ckeditorOperations.getRequirementHeader() );
    return formData;
};

export let addReuseSessionInLocalStorage = function( data ) {
    var sessionInfo = {
        sessionId: data.ReuseSessionId,
        productName: data.ProductInfo.projectName
    };
    localStorage.publish( 'ReuseAPISessionInfo', JSON.stringify( sessionInfo ) );
};

export let getReuseSessionFromLocalStorage = function( data ) {
    var reuseSessionInfo = JSON.parse( localStorage.get( 'ReuseAPISessionInfo' ) );
    if( reuseSessionInfo && reuseSessionInfo.productName && reuseSessionInfo.productName !== data.ProductInfo.projectName ) {
        // session info available in localStorage, but it is for different product/specification
        exports.removeReuseSessionFromLocalStorage();
        return null;
    }
    return reuseSessionInfo;
};

export let removeReuseSessionFromLocalStorage = function() {
    return localStorage.removeItem( 'ReuseAPISessionInfo' );
};

export let processQualityResponse = function( data ) {
    data.CalculateQualityResponse;
};

export let downloadReqQualityReport = function( data ) {
    var jsonRequestData = ckeditorOperations.downloadReqQualityReport( data );
    var defer = AwPromiseService.instance.defer();

    makeRequest( exports.getGetCorrectnessReportWebServicePath(),
        JSON.stringify( jsonRequestData ),
        function( response ) {
            response = parseData( response );
            if( response && response.Success ) {
                // Create a new Blob object using the response data of the onload object, the WS provides the MIME type as DataType
                var blob = b64toBlob( response.FileBase64, response.DataType );
                //Create a link element, hide it, direct
                //it towards the blob, and then 'click' it programatically
                if( window.top.navigator.msSaveOrOpenBlob ) {
                    //Store Blob in IE
                    window.top.navigator.msSaveOrOpenBlob( blob, response.FileName );
                } else {
                    let a = document.createElement( 'a' );
                    a.style = 'display: none';
                    document.body.appendChild( a );
                    //Create a DOMString representing the blob
                    //and point the link element towards it

                    let url = window.URL.createObjectURL( blob );
                    a.href = url;
                    a.download = response.FileName;
                    //programatically click the link to trigger the download
                    a.click();
                    //release the reference to the file by revoking the Object URL
                    window.URL.revokeObjectURL( url );
                }
                defer.resolve();
            } else {
                // Not a valid session, try reconnecting again
                data.ReuseSessionId = undefined;
                exports.removeReuseSessionFromLocalStorage();
                appCtxSvc.unRegisterCtx( 'showRequirementQualityData' );
                commandSvc.executeCommand( 'Arm0DownloadReqQualityData' );
            }
        } );

    return defer.promise;
};

export let showPatternTabs = function( data ) {
    var toggleState = data.eventMap[ 'Arm0ShowQualityMetricData.toggleButtonClicked' ].toggleState;
    if ( browserUtils.isIE ) {
        data.qualityTabs[1].visibleWhen = 'true';
        return;
    } else if( toggleState === undefined ) {
        toggleState = false;
    }
    data.qualityTabs[1].visibleWhen = String( toggleState );
    if ( toggleState ) {
        eventBus.publish( 'awTab.setSelected', data.qualityTabs[1] );
    } else {
        eventBus.publish( 'awTab.setSelected', data.qualityTabs[0] );
    }
};

var parseData = function( data ) {
    var result = undefined;
    try {
        if( data !== undefined ) {
            result = data.d;
        }
    } catch ( e ) {
        result = undefined;
    }
    return result;
};

var b64toBlob = function( b64Data, contentType, sliceSize ) {
    contentType = contentType || '';
    sliceSize = sliceSize || 512;

    var byteCharacters = atob( b64Data );
    var byteArrays = [];

    for( var offset = 0; offset < byteCharacters.length; offset += sliceSize ) {
        var slice = byteCharacters.slice( offset, offset + sliceSize );

        var byteNumbers = new Array( slice.length );
        for( var i = 0; i < slice.length; i++ ) {
            byteNumbers[ i ] = slice.charCodeAt( i );
        }

        var byteArray = new Uint8Array( byteNumbers );

        byteArrays.push( byteArray );
    }

    return new Blob( byteArrays, { type: contentType } );
};

/**
 * Method to get the input to TRC API with user preferred template
 * @param {Object} data the data object
 * @param {Object} ctx the context object
 * @returns {JSON} the object to be passed as input to TRC API
 */
export let getSetMetricsTemplateBlockInput = function( data, ctx ) {
    var templates = data.GetMetricsTemplateBlockResponse.data.d.MetricTemplates;

    if( templates ) {
        var matricId = templates[0].metricTemplateCode;
        var baseline = templates[0].metricTemplateName;
        if( ctx.preferences && ctx.preferences.REQ_TRC_metricTemplateCode ) {
            var prefValue = ctx.preferences.REQ_TRC_metricTemplateCode[ 0 ];
            for( var i = 0; i < templates.length; i++ ) {
                if( templates[i].metricTemplateCode.toString() === prefValue ) {
                    matricId = templates[i].metricTemplateCode;
                    baseline = templates[i].metricTemplateName;
                }
            }
        }
    }
    return {
        sessionId: data.ReuseSessionId,
        metricsSetId: matricId,
        baseLineName: baseline
    };
};

/**
 * Method to get the input to TRC API with user preferred template
 * @param {Object} data the data object
 * @param {Object} ctx the context object
 * @returns {JSON} the object to be passed as input to TRC API
 */
export let checkForTab = function( data ) {
    if( data.selectedTab && data.selectedTab.panelId === 'Arm0RequirementQualityPatternsStructure' ) {
        eventBus.publish( 'Arm0ReqPatternStructure.CalculateQuality' );
    } else {
        eventBus.publish( 'Arm0ShowQualityMetricData.callReuseAPI' );
    }
};

var makeRequest = function( apiUrl, theData, successFunction, responsetype ) {
    var rtype = 'json';
    if( responsetype !== undefined ) {
        rtype = responsetype;
    }
    try {
        $.ajax( {
            // Request URL
            url: apiUrl,

            // request data
            data: theData,
            // POST
            type: 'POST',
            // Expected response type
            dataType: rtype, //When you using this, that mean you want the php to return JSON format too
            contentType: 'application/json; charset=utf-8',

            // Success function
            success: function( data ) {
                successFunction( data );
            }
        } );
    } catch ( err ) {
        //
    }
};

export let clearQualityContextOnUnMount = function( subPanelContext ) {
    appCtxSvc.unRegisterCtx( 'showRequirementQualityData' );
    if( subPanelContext && subPanelContext.requirementCtx ) {
        let newRequirementCtx = subPanelContext.requirementCtx.getValue();
        newRequirementCtx.showRequirementQualityData = false;
        subPanelContext.requirementCtx.update( newRequirementCtx );
        let ckEditor = ckeditorOperations.getCKEditorInstance( newRequirementCtx.AWRequirementsEditor.id, appCtxSvc.ctx );
        if( ckEditor ) {
            ckEditor.fire( 'disablePatternAssist' );
        }
    }
};

/**
 * Service to show quality metic tables for requirement
 *
 * @member Arm0RequirementQualityService
 * @param {Object} appCtxSvc - application context service
 * @param {Object} awTableSvc - table service
 * @param {Object} cdm - client data model service
 * @returns {Object} exports
 */

export default exports = {
    getConnectWebServicePath,
    getInitProjectWebServicePath,
    getInitBlockWebServicePath,
    getHasBlockMetricsWebServicePath,
    getGetMetricsTemplateBlockWebServicePath,
    getSetMetricsTemplateBlockWebServicePath,
    getInitRequirementWebServicePath,
    getCalculateQualityWebServicePath,
    getAuthorTextAndCalculateQualityWebServicePath,
    getGetPatternGroupsWebServicePath,
    getGetCorrectnessReportWebServicePath,
    prePopulateDataForReuseAPI,
    showReqQualityData,
    GetPatternGroups,
    GetPatternsByPatternGroup,
    CalculateQuality,
    filterQualityResultWithSort,
    filterPatternStructureResult,
    filterPatternStateResult,
    filterPatternExamplesResult,
    filterQualityInvalidResultWithSort,
    qualityRuleSelected,
    clearHighlighting,
    setQualityDataResponse,
    getProductAndTopElementInfo,
    getCalculateQualityInput,
    addReuseSessionInLocalStorage,
    getReuseSessionFromLocalStorage,
    removeReuseSessionFromLocalStorage,
    processQualityResponse,
    downloadReqQualityReport,
    getCalQualityPromise,
    updateNextPossibleTerms,
    showPatternTabs,
    getNextElementTerms,
    setQualityRuleSelection,
    getSetMetricsTemplateBlockInput,
    checkForTab,
    clearQualityContextOnUnMount
};
