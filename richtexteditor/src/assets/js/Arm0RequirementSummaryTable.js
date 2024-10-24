// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * @module js/Arm0RequirementSummaryTable
 */
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import eventBus from 'js/eventBus';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import reqUtils from 'js/requirementsUtils';
import reqACEUtils from 'js/requirementsACEUtils';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import markupViewModel from 'js/Arm0MarkupViewModel';
import markupUtil from 'js/Arm0MarkupUtil';
import $ from 'jquery';
import _ from 'lodash';

var _data = null;
const REQ_SUMMARY_TABLE_SIZE_CLASS = 'aw-requirementsmanager-summaryTableSize';
export let getColumnFilters = function( data ) {
    return data.columnProviders.reqSummaryTableColumnProvider.columnFilters;
};

export let clearProviderSelection = function( data ) {
    if( data && data.dataProviders ) {
        var dataProvider = data.dataProviders.showReqSummaryTableProvider;
        if( dataProvider ) {
            dataProvider.selectNone();
        }
    }
};
/**
 * Refresh linked objects post tracelink creation
 * @param {object} data view model
 * @param {object} subPanelContext sub Panel Context
 */
export let postTracelinkCreated = function( data, subPanelContext ) {
    var eventData = data.eventData;
    if( !eventData.startItems || !eventData.endItems ) {
        return;
    }
    if( eventData.startItems.length <= 0 || eventData.endItems.length <= 0 ) {
        return;
    }

    var arrModelObjs = [];

    for( var i = 0; i < eventData.startItems.length; i++ ) {
        arrModelObjs.push( cdm.getObject( eventData.startItems[ i ].uid ) );
    }
    for( i = 0; i < eventData.endItems.length; i++ ) {
        arrModelObjs.push( cdm.getObject( eventData.endItems[ i ].uid ) );
    }

    if( arrModelObjs.length > 0 ) {
        soaSvc.post( 'Core-2007-01-DataManagement', 'refreshObjects', {
            objects: arrModelObjs
        } );
        exports.refreshTableData( data, subPanelContext );
    }
};

/**
 * Retrives the saved working context uid
 *
 * @returns {object}  savedWorkingContext  savedWorking Context
 */
export let getWorkingContextUid = function() {
    let savedWorkingContextUid = null;
    let occmgmtContext = appCtxSvc.getCtx( 'occmgmtContext' );
    if( occmgmtContext && occmgmtContext.workingContextObj ) {
        savedWorkingContextUid = occmgmtContext.workingContextObj.uid;
    }
    return savedWorkingContextUid;
};

/**
 * load the updated table properties
 *
 */
export let updateTableContent = function() {
    eventBus.publish( 'Arm0RequirementSummaryTable.refreshDataInTable' );
};

/**
 * load the updated table properties
 *
 * @param {Object} data - The panel's view model object
 * @param {object} subPanelContext sub Panel Context
 */
export let refreshTableData = function( data, subPanelContext ) {
    var bookmarkUid = exports.getWorkingContextUid();
    var inputData2 = {
        columnConfigInput: {
            clientName: 'AWClient',
            operationType: 'as_arranged',
            clientScopeURI: 'ReqSummaryTable'
        },
        saveColumnConfigData: {
            clientScopeURI: 'ReqSummaryTable',
            columnConfigId: data.dataProviders.showReqSummaryTableProvider.columnConfig.columnConfigId,
            columns: data.dataProviders.showReqSummaryTableProvider.newColumns,
            scope: 'LoginUser',
            scopeName: ''
        },
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Arm0SummaryTabProvider',
            searchCriteria: {
                selectedElementUid: subPanelContext.selected.uid,
                productContextUid: subPanelContext.context.occContext.productContextInfo.uid,
                bookmarkUid: bookmarkUid,
                enableSortAndPaging: 'true'
            },
            searchFilterFieldSortType: 'Alphabetical',
            searchSortCriteria: data.columnProviders.reqSummaryTableColumnProvider.sortCriteria,
            startIndex: data.dataProviders.showReqSummaryTableProvider.startIndex,
            columnFilters: data.columnProviders.reqSummaryTableColumnProvider.columnFilters
        },
        inflateProperties: true
    };
    soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', inputData2 );
};

/**
 * load the mathjax and fonts data
 *
 * @param {Object} data - The panel's view model object
 */
export let loadEquationFonts = function( data ) {
    reqUtils.loadEquationFonts( document );
};

/**
 * Set the underlying source object from the proxy object on to selection
 *
 * @param {Object} summaryTableSelectionData selection data of summary table
 * @param {Object} paramTableSelectionData selection data of parameters table
 * @param {Object} subPanelContext sub Panel Context
 * @param {Object} pageState page state
 * @param {Boolean} isSelectionSourceParamTable true when selection change is coming from parameter table, false otherwise
 */
export let setSourceObjectAsSelected = function( summaryTableSelectionData, paramTableSelectionData, subPanelContext, pageState, isSelectionSourceParamTable ) {
    const parentSelectionData = subPanelContext.selectionData;
    // if selection is in parameter table, notify parent about selection change
    if( isSelectionSourceParamTable && paramTableSelectionData.selected.length > 0 ) {
        // notify parent selection data so that objects are put on global selection
        parentSelectionData.update( {
            selected: paramTableSelectionData.selected
        } );
        return;
        // no need to proceed further
    }

    const summaryTableAdaptedSelection = [];
    const selections = summaryTableSelectionData.selected;
    if( selections.length > 0 && selections[ 0 ].props.arm0SourceElement ) {
        var objectUid = selections[ 0 ].props.arm0SourceElement.dbValues[ 0 ];
        var obj = cdm.getObject( objectUid );
        summaryTableAdaptedSelection.push( obj );

        if( obj.props.awb0UnderlyingObject ) {
            var modelObject = cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] );
            var cellProp = [ 'awp0CellProperties' ];
            var arrModelObjs = [ modelObject ];
            reqUtils.loadModelObjects( arrModelObjs, cellProp );
        }

        const requirementCtx = appCtxSvc.getCtx( 'requirementCtx' );
        const reqCtx = appCtxSvc.getCtx( 'requirements' );
        let noChange = false;
        if( reqCtx && reqCtx.selectedObjects && reqCtx.selectedObjects.length > 0 ) {
            noChange = reqCtx.selectedObjects[ 0 ].uid === obj.uid;
        }
        if( !noChange && requirementCtx && requirementCtx.splitPanelLocation && requirementCtx.splitPanelLocation === 'bottom' ) {
            var syncTableEventData = {
                selectedParents: [ obj ]
            };
            eventBus.publish( 'uniformParamTable.applySync', syncTableEventData );
        }
    }

    // notify parent selection data so that object is put on global selection
    parentSelectionData.update( {
        selected: summaryTableAdaptedSelection
    } );

    if( summaryTableAdaptedSelection.length === 0 ) {
        // if there is no selection in summary table, pass parent selection for parameter table to react upon
        summaryTableAdaptedSelection.push( subPanelContext.selected );
    }
    // update page state for parameter table to react upon
    pageState.update( {
        ...pageState.value,
        summaryTableAdaptedSelection: summaryTableAdaptedSelection
    } );
};

/**
 * To get selected item Object details
 * @param {Object} data - view model data
 */
export let getSelectedRefObj = function( data ) {
    data.selectedRefObj = appCtxSvc.getCtx( 'summaryTableSelectedObjUid' );
    return {
        selectedRefObj: data.selectedRefObj
    };
};

/**
 * Get Input data for getSpecificationSegment.
 *
 * @param {Object} data - The panel's view model object
 * @returns {Object} - Json object
 */
export let getSpecificationSegmentInput = function( data ) {
    var inputCtxt = reqACEUtils.getInputContext();
    data.selectedRefObj = appCtxSvc.getCtx( 'summaryTableSelectedObjUid' );
    return {
        inputCtxt: inputCtxt,
        inputObjects: [ data.selectedRefObj.modelRevObject ],
        options: [ 'ExportContent' ]
    };
};

/**
 * Retrieve comments from getSpecificationSegment output
 *
 * @param {Object} data - The panel's view model object
 */
export let getCommentsAfterDataLoad = function( data ) {
    if( data.content && data.content.markUpData && data.content.markUpData.length > 0 ) {
        var markups = JSON.parse( data.content.markUpData[ 0 ].markups );
        var markupJson = [];

        for( let index = 0; index < markups.length; index++ ) {
            const element = markups[ index ];
            if( !element.attributes ) {
                markupJson.push( element );
            }
        }
        if( markupJson.length > 0 ) {
            var comments = JSON.stringify( markupJson );
            markupViewModel.setMarkupsForSummaryTab( comments );
            appCtxSvc.unRegisterCtx( 'reqMarkupCtx' );
            appCtxSvc.unRegisterCtx( 'markup' );
            markupUtil.setMarkupContext( data );
            _data = data;
            commandPanelService.activateCommandPanel( 'Arm0MarkupMain', 'aw_toolsAndInfo', null, true );
        }
    }
};

var _getCreateMarkupInput = function( data ) {
    return markupUtil.getCreateMarkupInput( data.content );
};

/**
 * getInputValues for SOA call
 * @param {Object} data - data Object
 * @return {Object} created input for SOA call
 */
export let getInputValues = function( data ) {
    var markUpInput = [];
    var prodCtxt = occMgmtStateHandler.getProductContextInfo();
    var requestPref = {};

    markupUtil.updateMarkupContext( data );
    var selectedUid = appCtxSvc.getCtx( 'summaryTableSelectedObjUid' ).uid;
    var selected = cdm.getObject( selectedUid );
    markUpInput = _getCreateMarkupInput( data );

    appCtxSvc.unRegisterCtx( 'reqMarkupCtx' );

    var baseURL = browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
    requestPref.base_url = baseURL;
    var occConfigInfo = reqACEUtils.prepareOccConfigInfo( prodCtxt, false );
    var inputContext = reqACEUtils.prepareInputContext( occConfigInfo, 1, null, prodCtxt, requestPref );
    return {
        inputCtxt: inputContext,
        createInput: [],
        setContentInput: [],
        markUpInput: markUpInput,
        selectedElement: { uid: selected.uid, type: selected.type }
    };
};

/**
 * Save Markups to Server.
 *
 * @return {Promise} Promise that is resolved when save edit is complete
 */
export let saveMarkupContent = function( data ) {
    var deferred = AwPromiseService.instance.defer();

    var createUpdateInput = exports.getInputValues( data );
    if( createUpdateInput ) {
        var input = {
            createUpdateInput: createUpdateInput
        };
        var promise = soaSvc.post( 'Internal-AwReqMgmtSe-2019-06-SpecNavigation', 'createOrUpdateContents', input );
        promise.then( function( response ) {
            exports.updateTableContent();
            deferred.resolve( response );
        } )
            .catch( function( error ) {
                deferred.reject( error );
            } );
    } else {
        deferred.resolve();
    }
    return deferred.promise;
};

/**
 * Set Summary Table height
 */
export let setSummaryTableHeight = function( subPanelContext, state ) {
    if( !subPanelContext.fullScreenState.value ) {
        let height = 0;
        let element = document.getElementsByClassName( REQ_SUMMARY_TABLE_SIZE_CLASS )[ 0 ];
        if( element && !state.showSplitPanel ) {
            let mainLayoutElement = _getMainLayoutPanel( element );

            if( mainLayoutElement ) {
                height = mainLayoutElement.offsetHeight;
            } else if( window.innerHeight > element.offsetTop ) {
                height = window.innerHeight - element.offsetTop;
                height = height > 300 ? height : 300;
            } else {
                // this means panel section of UV is drop downed and have to scroll to view it.
                height = window.innerHeight - 120; // 60px from header + 60px from footer
            }

            var panelScrollBody = $( element );
            panelScrollBody.attr( 'style', 'height:' + height + 'px' );
        }
    } else {
        removeSummaryTableStyle();
    }
};

/**
 * Reduces summary table height to fit Parameters table on page
 *
 * @param {Object} state - state
 * @param {Object} subPanelContext - sub Panel Context
 */
export let resizeSummaryTable = function( state, subPanelContext ) {
    let height = 0;
    let element = document.getElementsByClassName( REQ_SUMMARY_TABLE_SIZE_CLASS )[ 0 ];

    if( element ) {
        let mainLayoutElement = _getMainLayoutPanel( element );
        if( mainLayoutElement ) {
            height = mainLayoutElement.offsetHeight;
            if( state.showSplitPanel ) {
                height -= 250;
            }
        }
        var panelScrollBody = $( element );
        panelScrollBody.attr( 'style', 'height:' + height + 'px' );
    }

    if( subPanelContext.fullScreenState.value && !state.showSplitPanel ) {
        removeSummaryTableStyle();
    }
};

/**
 * Removes summary table style
 */
function removeSummaryTableStyle() {
    //In full screen mode remove existing style added for height
    let ele = document.getElementsByClassName( REQ_SUMMARY_TABLE_SIZE_CLASS )[ 0 ];
    if( ele && ele.hasAttribute( 'style' ) ) {
        ele.removeAttribute( 'style' );
    }
}

/**
 * Find if given element is added inside the main panel, if yes return main panel element
 *
 * @param {Object} element - html dom element
 * @returns {Object} html dom element or null
 */
function _getMainLayoutPanel( element ) {
    if( !element || element.classList.contains( 'aw-layout-sublocationContent' ) ) {
        return null;
    }
    if( element.classList.contains( 'aw-panel' ) || element.classList.contains( 'aw-widgets-multiSelectContainer' ) ) {
        // aw-panel - in case of ACE Doc tab. else 'aw-widgets-multiSelectContainer'
        return element;
    }
    return _getMainLayoutPanel( element.parentElement );
}

let updatePartialState = function( state, path, value, toggleValue ) {
    const newValue = { ...state.value };
    const valueToSet = toggleValue ? !value : value;
    _.set( newValue, path, valueToSet );
    state.update( newValue );
};

/**
 * Returns the Arm0RequirementSummaryTable instance
 *
 * @member Arm0RequirementSummaryTable
 */

const exports = {
    getColumnFilters,
    clearProviderSelection,
    postTracelinkCreated,
    loadEquationFonts,
    setSourceObjectAsSelected,
    getSelectedRefObj,
    getSpecificationSegmentInput,
    getCommentsAfterDataLoad,
    refreshTableData,
    getInputValues,
    updateTableContent,
    getWorkingContextUid,
    saveMarkupContent,
    setSummaryTableHeight,
    updatePartialState,
    resizeSummaryTable
};

export default exports;
