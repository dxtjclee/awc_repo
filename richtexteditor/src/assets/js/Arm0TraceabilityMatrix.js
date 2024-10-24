/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * Module for the Requirement Documentation Page
 *
 * @module js/Arm0TraceabilityMatrix
 */
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import listBoxService from 'js/listBoxService';
import awTableSvc from 'js/awTableService';
import AwPromiseService from 'js/awPromiseService';
import uwPropertySvc from 'js/uwPropertyService';
import commandPanelService from 'js/commandPanel.service';
import requirementsUtils from 'js/requirementsUtils';
import reqTraceabilityMatrixService from 'js/reqTraceabilityMatrixService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import $ from 'jquery';
import fmsUtils from 'js/fmsUtils';
import soaSvc from 'soa/kernel/soaService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import localeService from 'js/localeService';
import notyService from 'js/NotyModule';
import { popupService } from 'js/popupService';
import modelPropertySvc from 'js/modelPropertyService';
import dmSvc from 'soa/dataManagementService';
import AwTimeoutService from 'js/awTimeoutService';
import navigationSvc from 'js/navigationService';

var exports = {};
var cellDataMap = {};
var _data;
var _ctx;
var tracelinkIDVsMatrixCell = {};
var tracelinkIDVsPersistentObjMatrixCell = {};
var matrixType = null;
var sourceObjects2 = [];
var targetObjects2 = [];
var matrixType = null;
var nullProductContext = 'AAAAAAAAAAAAAA';
var revToOccMap = {};
var _page_size = 25;
var _selectedCell = null;
var showEmptyRowsandColsActionState = true;
var parentRowUid = null;
var parentColUid = null;

var haveFullData = false;
var cachedRows;
var cachedCols;
var useCachedData = false;
var getChildMatrixServiceData = null;

var resource = 'MatrixMessages';
var localTextBundle = localeService.getLoadedText( resource );
var tlTypeListIn = [ localTextBundle.all ];
let tltotypeMap = new Map();
var tlTypeList = [];

let _popupRef = null;

/*
    Following block contains the state of the sorting applied on entire Traceability Matrix
    specifically on ROW/COLUMN/INDIVDUAL ROW/INDIVIDUAL COLUMN
*/
let sortOn = '';
let evtDataIndividualRowSort = null;
let evtDataIndividualColSort = null;

let rowSort = '';
let colSort = '';

let individualRowSort = '';
let individualColSort = '';

let rowSortType = 'NOSORT';
let colSortType = 'NOSORT';

let individualRowSortType = 'NOSORT';
let individualColSortType = 'NOSORT';

let noSortRow = false;
let noSortCol = false;

/**
 * OpenCreateTracelinkPanel
 *
 * @param {Object}
 *            elementsInCreateTracelink elementsInCreateTracelink
 */
export let OpenCreateTracelinkPanel = function( elementsInCreateTracelink, data ) {
    if( elementsInCreateTracelink && elementsInCreateTracelink.sourceObject && elementsInCreateTracelink.destObject ) {
        _data.cellSelected = true;
        var sourceObjects = [];
        var destObjects = [];
        var arrModelObjs = [];
        for( var i = 0; i < elementsInCreateTracelink.sourceObject.uid.length; i++ ) {
            var sourceObject = { uid: elementsInCreateTracelink.sourceObject.uid[ i ] };
            sourceObjects.push( sourceObject );
            arrModelObjs.push( sourceObject );
        }
        for( var j = 0; j < elementsInCreateTracelink.destObject.uid.length; j++ ) {
            var destObject = { uid: elementsInCreateTracelink.destObject.uid[ j ] };
            destObjects.push( destObject );
            arrModelObjs.push( destObject );
        }
        var cellProp = [ 'awb0UnderlyingObject', 'object_string' ];
        appCtxService.registerCtx( 'isOpenFromTraceabilityMatrix', true );
        requirementsUtils.loadModelObjects( arrModelObjs, cellProp ).then( function() {
            _data.tracelinkSourceObject = [];
            _data.tracelinkDestinationObject = [];
            var sourceObjectRevision = [];
            var destObjectRevision = [];
            for( var i = 0; i < elementsInCreateTracelink.sourceObject.uid.length; i++ ) {
                var sourceObjectRevision1 = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( sourceObjects[ i ].uid ) );
                sourceObjectRevision[ i ] = sourceObjectRevision1;
                var tracelinkSourceObject = requirementsUtils.getTracelinkObject( elementsInCreateTracelink.sourceObject.uid[ i ], sourceObjectRevision[ i ].uid );
                _data.tracelinkSourceObject[ i ] = tracelinkSourceObject;
            }
            for( var j = 0; j < elementsInCreateTracelink.destObject.uid.length; j++ ) {
                var destObjectRevision1 = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( destObject.uid ) );
                destObjectRevision[ j ] = destObjectRevision1;
                var tracelinkDestinationObject = requirementsUtils.getTracelinkObject( elementsInCreateTracelink.destObject.uid[ j ], destObjectRevision[ j ].uid );
                _data.tracelinkDestinationObject[ j ] = tracelinkDestinationObject;
            }
            if( _data.srcContextInfo && _data.srcContextInfo.uid !== nullProductContext ) {
                elementsInCreateTracelink.rowProductContextFromMatrix = _data.srcContextInfo.uid;
            } else { elementsInCreateTracelink.isTraceabilityMatrixObject = true; }
            data.dispatch( { path: 'data.tracelinkSourceObject', value: _data.tracelinkSourceObject } );
            data.dispatch( { path: 'data.tracelinkDestinationObject', value: _data.tracelinkDestinationObject } );
            eventBus.publish( 'requirementDocumentation.addObjectToTracelinkPanel', elementsInCreateTracelink );
        } );
    }
};

/**
 * OpenCloseCreateTracelinkPanel
 *
 * @param {Object}
 *            elementsInCreateTracelink elementsInCreateTracelink
 * @param {Object}
 *            ctx ctx
 */
export let OpenCloseCreateTracelinkPanel = function( elementsInCreateTracelink, ctx, data ) {
    if( appCtxService.ctx.CreateTraceLinkPopupCtx ) {
        // If Create tracelink panel is already opened, close it
        eventBus.publish( 'CreateTracelinkPopup.Close' );
    } else if( _selectedCell ) {
        elementsInCreateTracelink = {
            sourceObject: { uid: _selectedCell.rowUid },
            destObject: { uid: _selectedCell.colUid }
        };
        exports.OpenCreateTracelinkPanel( elementsInCreateTracelink, data );
    }
};

/**
 * processResponse
 *
 * @param {Object}
 *            response response
 */
export let processResponse = function( response ) {
    fmsUtils.openFile( response.generatedFileTicket, appCtxService.ctx.selected.props.object_name.dbValues[ 0 ] + '.pdf' );
};

/**
 * updateFileContentInFormData
 *
 * @param {Object}
 *            data data
 */
export let updateFileContentInFormData = function( data, extra ) {
    //main_svg
    var form = $( '#fileUploadForm' );
    data.formData = new FormData( $( form )[ 0 ] );
    var svgElement = document.getElementById( 'main_svg' );
    var clonedElement = svgElement.cloneNode( true );
    clonedElement.setAttribute( 'xmlns', 'http://www.w3.org/2000/svg' );
    data.formData.append( 'fmsFile', new Blob( [ clonedElement.outerHTML ], { type: 'text/plain' } ) );
    data.formData.append( 'fmsTicket', data.fmsTicket );
    data.height = parseInt( svgElement.getAttribute( 'height' ) );
    data.width = parseInt( svgElement.getAttribute( 'width' ) );
    _data.formData = data.formData;
    eventBus.publish( 'Arm0TraceabilityMatrix.uploadFile' );
    return data.formData;
};

export let postTracelinkDeletion = function( elementsInDeleteTracelink ) {
    eventBus.publish( 'Arm0TraceabilityMatrix.tracelinkDeleted', { elementsInDeleteTracelink: elementsInDeleteTracelink } );
};

/**
 * tracelinkDeleted
 *
 * @param {Object} elementsInDeleteTracelink elementsInDeleteTracelink
 * @param {ctx} ctx - ctx instance Object
 * @param {Object} data - The panel's view model object
 */
export let tracelinkDeleted = function( elementsInDeleteTracelink, ctx, data ) {
    if( data.eventData && data.eventData.elementsInDeleteTracelink ) {
        elementsInDeleteTracelink = data.eventData.elementsInDeleteTracelink;
        data.eventData.elementsInDeleteTracelink = null;
    }
    if( Array.isArray( elementsInDeleteTracelink ) ) {
        _.forEach( elementsInDeleteTracelink, function( obj ) {
            reqTraceabilityMatrixService.tracelinkDeleted( obj.relation, tracelinkIDVsMatrixCell, cellDataMap );
            if( data.tracelinkTableData ) {
                for( var i = data.tracelinkTableData.length - 1; i >= 0; i-- ) {
                    if( data.tracelinkTableData[ i ].tracelinkUid === obj.relation ) {
                        data.tracelinkTableData.splice( i, 1 );
                    }
                }
            }
        } );
    }
    processData( data, appCtxService.ctx );
    eventBus.publish( 'Arm0Traceability.refreshTableData' );
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
/**
 * loadFlatTableData
 *
 * @param {Object} data data
 * @return {Object} loadResult table data
 */

export let loadFlatTableData = function( data ) {
    data.totalFound = 0;
    var columns = data.columnProviders.clientScopeUI.columns;
    var vmRows = [];
    if( data.tracelinkTableData ) {
        for( var rowNdx = 0; rowNdx < data.tracelinkTableData.length; rowNdx++ ) {
            var columnData = data.tracelinkTableData[ rowNdx ].data;
            var vmObject = {};
            var props = {};
            _.forEach( columns, function( columnInfo, columnNdx ) {
                props[ columnInfo.name ] = _createProp( columnInfo.name, columnData[ columnNdx ], 'STRING', columnInfo.displayName );
            } );
            vmObject.props = props;
            vmObject.tracelinkUid = data.tracelinkTableData[ rowNdx ].tracelinkUid;
            vmObject.relatedObjectUid = data.tracelinkTableData[ rowNdx ].relatedObjectUid;
            vmObject.primaryObjectUid = data.tracelinkTableData[ rowNdx ].primaryObjectUid;
            vmObject.alternateID = data.tracelinkTableData[ rowNdx ].tracelinkUid;
            vmRows.push( vmObject );
        }
    }
    var loadResult = awTableSvc.createTableLoadResult( vmRows.length );
    loadResult.searchResults = vmRows;
    loadResult.totalFound = vmRows.length;
    var dataProvider = data.dataProviders.traceMatrixCellPropDataProvider;
    dataProvider.update( vmRows, vmRows.length );

    return loadResult;
};

/**
 * Show delete trace link warning message
 *
 * @param {Object} i18n - The view model data
 * @param {Object} vmo - vmo
 */
export let showDeleteTracelinkTMWarning = function( i18n, eventData ) {
    var msg;
    if( eventData && eventData.vmo ) {
        // Delete selection
        var selectedObjects = eventData.vmo.getSelectedObjects();
        var name = '';
        if( selectedObjects.length > 0 ) { name = selectedObjects[ 0 ].props.object_complying.displayValue; }
        msg = i18n.deleteTracelinkConfirmation.replace( '{0}', name );
    } else {
        // Delete ALL
        var selectedObjects = _data.dataProviders.traceMatrixCellPropDataProvider.getViewModelCollection().loadedVMObjects;
        var name = '';
        if( selectedObjects.length > 0 ) { name = selectedObjects[ 0 ].props.object_complying.displayValue; }
        msg = i18n.deleteAllTracelinkConfirmation.replace( '{0}', name );
    }

    var buttons = [ {
        addClass: 'btn btn-notify',
        text: i18n.cancel,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: 'btn btn-notify',
        text: i18n.delete,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Arm0TraceabilityMatrix.deleteExistingTracelinkInTM', { vmo: eventData.vmo } );
        }
    } ];

    notyService.showWarning( msg, buttons );
};

/**
 * Get input data for trace link Deletion
 *
 * @param {Object} data - The panel's view model object
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @return {Any} input data for trace link deletion
 */
export let getInputDeleteTraceLinkInTM = function( data, eventData ) {
    var selectedObjects;
    if( eventData && eventData.vmo ) {
        selectedObjects = eventData.vmo.getSelectedObjects();
    }
    if( !selectedObjects || selectedObjects.length === 0 ) {
        selectedObjects = _data.dataProviders.traceMatrixCellPropDataProvider.getViewModelCollection().loadedVMObjects;
    }
    var elementsToRemove = [];
    data.refreshObjects = [];
    data.elementsInDeleteTracelink = [];
    if( selectedObjects ) {
        _.forEach( selectedObjects, function( obj ) {
            elementsToRemove.push( {
                uid: obj.tracelinkUid
            } );
            data.refreshObjects.push( {
                uid: obj.primaryObjectUid
            } );
            data.refreshObjects.push( {
                uid: obj.relatedObjectUid
            } );
            data.elementsInDeleteTracelink.push( {
                relation: obj.tracelinkUid
            } );
        } );
    }
    data.dispatch( { path: 'data.refreshObjects', value: data.refreshObjects } );
    data.dispatch( { path: 'data.elementsInDeleteTracelink', value: data.elementsInDeleteTracelink } );
    return elementsToRemove;
};

/**
 * Display popup with Tracelink information on cell
 *
 * @param {Object}
 *            data - The panel's view model object
 * @param {Object}
 *            ctx - The context
 */
export let showTracelinksPopup = function( data, ctx ) {
    var rowUid = [];
    var colUid = [];
    var eventDataFromShowTracelink = data.eventMap[ 'Arm0Traceability.showTracelinksPopup' ];
    rowUid = eventDataFromShowTracelink.rowUid;
    colUid = eventDataFromShowTracelink.colUid;
    var isMultipleSelection = eventDataFromShowTracelink.isMultipleSelection;
    var tracelinkRowData = [];
    _selectedCell = null;
    if( rowUid[ 0 ] && colUid[ 0 ] && rowUid[ 0 ] !== -1 && colUid[ 0 ] !== -1 ) {
        _selectedCell = _.cloneDeep( data.eventData );

        appCtxService.registerCtx( 'Arm0TraceabilityMatrixSelectedCell', _selectedCell );
        _selectedCell.sourceObject = [];
        _selectedCell.destObject = [];
        var linkInfo = [];
        if( data.eventData.operationType === 'colWise' ) {
            for( var i = 0; i < rowUid.length; i++ ) {
                var inputObject = {
                    uid: rowUid[ i ]
                };
                _selectedCell.sourceObject.push( inputObject );
                var key = rowUid[ i ].concat( '+' ).concat( colUid[ 0 ] );
                linkInfo.push( cellDataMap[ key ] );
            }
            _selectedCell.destObject[ 0 ] = {
                uid: colUid[ 0 ]
            };
        } else if( data.eventData.operationType === 'rowWise' ) {
            for( var j = 0; j < colUid.length; j++ ) {
                var inputObject = {
                    uid: colUid[ i ]
                };
                _selectedCell.destObject.push( inputObject );
                var key = rowUid[ 0 ].concat( '+' ).concat( colUid[ j ] );
                linkInfo.push( cellDataMap[ key ] );
            }
            _selectedCell.sourceObject[ 0 ] = {
                uid: rowUid[ 0 ]
            };
        } else {
            _selectedCell.sourceObject[ 0 ] = {
                uid: rowUid[ 0 ]
            };
            _selectedCell.destObject[ 0 ] = {
                uid: colUid[ 0 ]
            };
            var key = rowUid[ 0 ].concat( '+' ).concat( colUid[ 0 ] );
            linkInfo.push( cellDataMap[ key ] );
        }
        appCtxService.registerCtx( 'matrixCellSelected', true );
        if( _data.srcContextInfo ) {
            appCtxService.registerCtx( 'rowProductContextFromMatrix', _data.srcContextInfo.uid );
        }
        appCtxService.registerCtx( 'srcObjectFromMatrix', rowUid[ 0 ] );
        if( appCtxService.ctx.CreateTraceLinkPopupCtx ) {
            var panelContext = {};
            panelContext.sourceObject = {};
            panelContext.destObject = {};

            var cellProp = [ 'awp0CellProperties', 'awb0UnderlyingObject' ];
            panelContext.sourceObject.uid = rowUid;
            panelContext.destObject.uid = colUid;
            requirementsUtils.loadModelObjects( [ panelContext.sourceObject, panelContext.destObject ], cellProp ).then( function() {
                panelContext.sourceObject = cdm.getObject( rowUid );
                panelContext.destObject = cdm.getObject( colUid );
                var sourceObjectRevision = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( rowUid ) );
                var destObjectRevision = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( colUid ) );

                _data.tracelinkSourceObject = requirementsUtils.getTracelinkObject( rowUid, sourceObjectRevision.uid );
                _data.tracelinkDestinationObject = requirementsUtils.getTracelinkObject( colUid, destObjectRevision.uid );
            } );
            appCtxService.registerCtx( 'panelContext', panelContext );
        }
        var linkInfoObjectArr = [];
        for( var k = 0; k < linkInfo.length; k++ ) {
            if( linkInfo[ k ] ) {
                linkInfoObjectArr.push( linkInfo[ k ] );
            }
        }
        if( linkInfoObjectArr.length ) {
            for( var l = 0; l < linkInfoObjectArr.length; l++ ) {
                var linkInfoObject = linkInfoObjectArr[ l ];
                _.forEach( linkInfoObject.complyingLinksInfo, function( linkInfoObject ) {
                    if( data.tlType.dbValue === linkInfoObject.tracelinkType || data.tlType.dbValue === localTextBundle.all ) {
                        var infoTracelink = requirementsUtils.readTracelinkInfo( linkInfoObject );
                        tracelinkRowData.push( infoTracelink );
                    }
                } );

                _.forEach( linkInfoObject.definingLinksInfo, function( linkInfoObject ) {
                    if( data.tlType.dbValue === linkInfoObject.tracelinkType || data.tlType.dbValue === localTextBundle.all ) {
                        var infoTracelink = requirementsUtils.readTracelinkInfo( linkInfoObject );
                        tracelinkRowData.push( infoTracelink );
                    }
                } );
            }
        }
    } else {
        data.cellSelected = false;
        appCtxService.registerCtx( 'matrixCellSelected', false );
        appCtxService.unRegisterCtx( 'Arm0TraceabilityMatrixSelectedCell' );
    }
    data.tracelinkTableData = tracelinkRowData;
    data.dispatch( { path: 'data', value: data } );

    if( !isMultipleSelection ) {
        data.totalFound = 0;
        eventBus.publish( 'Arm0Traceability.refreshTableData' );
    }
};

export let closeMatrixTablePropView = function() {
    var eventData = {
        colUid: '-1',
        rowUid: '-1'
    };
    eventBus.publish( 'Arm0Traceability.showTracelinksPopup', eventData );
};

/**
 * Stuff row title and col title into one packet.
 *
 * @param {Object} data The context
 * @return {Object} Object // row and collumn title
 */
var stuffLabelData = function( data ) {
    var rt = data.srcObjectInfo.displayName;
    var ct = data.targetObjectInfo.displayName;

    return {
        row_title: rt,
        col_title: ct
    };
};

let calculateFilterOptions = function( data, response ) {
    var filterOptions = [];
    filterOptions.push( 'TRACELINK' );
    if( response.filterOutput && data.filterOutput && data.filterOutput.searchFilterMap ) {
        var isSourceIndexed = data.filterOutput.searchFilterMap.SOURCE_INDEXED;
        var isTargetIndexed = data.filterOutput.searchFilterMap.TARGET_INDEXED;

        if( isSourceIndexed && data.srcObjectInfo.occurrence && data.srcObjectInfo.occurrence.uid ) {
            if( data.targetObjectInfo.occurrence && data.targetObjectInfo.occurrence.uid && data.targetObjectInfo.occurrence.uid === data.srcObjectInfo.occurrence.uid ) {
                filterOptions.push( 'ROW_COLUMN' );
            } else {
                filterOptions.push( 'ROW' );
            }
        }
        if( isTargetIndexed && data.targetObjectInfo.occurrence && data.targetObjectInfo.occurrence.uid && data.targetObjectInfo.occurrence.uid !== data.srcObjectInfo.occurrence.uid ) {
            filterOptions.push( 'COLUMN' );
        }

        // Get receipe count
        var filterKeys = Object.keys( response.filterOutput.searchFilterMap );
        for( let index = 0; index < filterKeys.length; index++ ) {
            const key = filterKeys[ index ];
            if( key.startsWith( 'PopulateRecipeCountSource' ) ) {
                var keyValueS = key.split( '=' );
                if( keyValueS.length > 1 ) {
                    var countS = keyValueS[ 1 ];
                    appCtxService.registerPartialCtx( 'MatrixContext.sourceFilterReceipeCount', countS );
                }
            }
            if( key.startsWith( 'PopulateRecipeCountTarget' ) ) {
                var keyValueT = key.split( '=' );
                if( keyValueT.length > 1 ) {
                    var countT = keyValueT[ 1 ];
                    appCtxService.registerPartialCtx( 'MatrixContext.targetFilterReceipeCount', countT );
                }
            }
        }
    }
    appCtxService.registerPartialCtx( 'MatrixContext.filterOptions', filterOptions );
};

export let populateFilterInformation = function( data, ctx ) {
    var activeFilterView = appCtxService.ctx.MatrixContext.activeFilterView;
    if( activeFilterView && ( activeFilterView === 'ROW' || activeFilterView === 'ROW_COLUMN' ) && data.filterOutput ) {
        appCtxService.registerPartialCtx( 'MatrixContext.sourceFilterOutput', data.filterOutput );
        appCtxService.registerPartialCtx( 'MatrixContext.sourceFilterReceipeCount', data.filterOutput.recipe.length );
    }
    if( activeFilterView && activeFilterView === 'COLUMN' && data.filterOutput ) {
        appCtxService.registerPartialCtx( 'MatrixContext.targetFilterOutput', data.filterOutput );
        appCtxService.registerPartialCtx( 'MatrixContext.targetFilterReceipeCount', data.filterOutput.recipe.length );
    }
    appCtxService.registerPartialCtx( 'MatrixContext.tracelinkFilterOutput', appCtxService.ctx.MatrixContext.typeFilter );
};

/**
 * Initialize HTML content
 *
 * @param {Object}
 *            data - The panel's view model object
 * @param {Object}
 *            ctx - The context
 */
// eslint-disable-next-line complexity
export let processDataFromServer = function( data, ctx ) {
    var MatrixContext = appCtxService.getCtx( 'MatrixContext' );
    if( MatrixContext ) {
        if( MatrixContext.matrixObj && appCtxService.ctx.locationContext.modelObject && appCtxService.ctx.locationContext.modelObject.type === 'Awp0TraceabilityMatrix' ) {
            MatrixContext.matrixObj = appCtxService.ctx.locationContext.modelObject;
        } else if( MatrixContext.matrixObj && appCtxService.ctx.selected.type === 'Awp0TraceabilityMatrix' ) {
            MatrixContext.matrixObj = appCtxService.ctx.selected;
        }

        if( !MatrixContext.matrixObj && appCtxService.ctx.xrtSummaryContextObject && appCtxService.ctx.xrtSummaryContextObject.uid ) {
            var obj = cdm.getObject( appCtxService.ctx.xrtSummaryContextObject.uid );
            MatrixContext.matrixObj = obj;
        }
        appCtxService.updateCtx( 'MatrixContext', MatrixContext );
    }
    // populateFilterInformation( data, ctx );
    if( !data.pageInfo ) {
        reqTraceabilityMatrixService.resetPageInfo( data );
    }

    _data.rowObjects = _.cloneDeep( data.rowObjects );
    _data.colObjects = _.cloneDeep( data.colObjects );

    /*
     * Important: clone rowObjects and colObjects and cache as globals this is needed for matrix row expand/collapse operations.
     */
    _data.clonedRowObjects = _.cloneDeep( _data.rowObjects );
    _data.clonedColObjects = _.cloneDeep( _data.colObjects );

    if( data.targetObjectInfo !== undefined && data.srcObjectInfo !== undefined ) {
        if( data.matrixType === 'Full-Rollup Matrix' || data.matrixType === 'Quick Matrix' ) {
            var _tmpSource = {
                uid: data.srcObjectInfo.occurrence.uid
            };
            var _tmpTarget = {
                uid: data.targetObjectInfo.occurrence.uid
            };

            _loadAndSetSourceTargetObjects( appCtxService.ctx, _tmpSource, _tmpTarget );
        }
        _setSourceTargetProductContext( appCtxService.ctx, data.srcContextInfo, data.targetContextInfo );

        appCtxService.registerCtx( 'matrixType', data.matrixType );
        appCtxService.registerCtx( 'generateTracebilityMatrixOnReveal', false );

        if( data.matrixType === 'Dynamic Matrix' ) {
            appCtxService.registerCtx( 'tlmTreeMode', false );
        }

        applyServiceData( data );

        /* IMPORTANT:
            There is need to sort the row and col objects if state of sort is present,
            it is required because server returs unsorted objects and those are replaced as it is in the data
        */

        // Check if row sort required : This is the header sort
        if( rowSort ) {
            data.rowObjects = applyRowGlobalSort( data.rowObjects, true );
            _data.rowObjects = data.rowObjects;
        }

        // Check if col sort required : This is the header sort
        if( colSort ) {
            data.colObjects = applyColGlobalSort( data.colObjects, true );
            _data.colObjects = data.colObjects;
        }

        if( !appCtxService.ctx.tlmTreeMode ) {
            // list mode, replace model with new data
            cellDataMap = getCellMap( data, data.tracelinkInfo );
        } else {
            // in tree mode new data has to be merged into moded
            var cells = getCellMap( data, data.tracelinkInfo );
            _.merge( cellDataMap, cells );
            /*
             * IMPORTANT : In the case of parent rows and cols
             */
            if( appCtxService.ctx.MatrixContext.parentRows && !parentRowUid ) {
                if( !noSortRow ) {
                    // column was expanded so keep old rows
                    data.rowObjects = appCtxService.ctx.MatrixContext.parentRows;
                    _data.rowObjects = data.rowObjects;
                }
            }
            if( parentRowUid ) {
                var newRows = [];
                var alreadyExpandedParents = [];
                var childDataAppended = false;
                _.forEach( appCtxService.ctx.MatrixContext.parentRows, function( obj ) {
                    if( !alreadyExpandedParents.includes( obj.parentUid ) ) {
                        if( alreadyExpandedParents.length > 0 ) { // concate childs (from server) after removing/skipping all childs
                            newRows = newRows.concat( data.rowObjects );
                            childDataAppended = true;
                        }
                        newRows.push( obj );
                        alreadyExpandedParents = [];
                    } else if( obj.occurrence ) {
                        alreadyExpandedParents.push( obj.occurrence.uid ); // Need to check all child, to remove/skip sub childs
                    }

                    if( obj.occurrence && obj.occurrence.uid === parentRowUid ) {
                        if( !obj.isExpanded ) { // If already not expanded
                            obj.isExpanded = true;
                            // This is the tracelink count sort
                            if( individualColSort && individualColSortType === 'ASC' || individualColSortType === 'DESC' ) {
                                newRows = [ ...newRows, ..._sortRowObjectsWithTracelinkCount( data.rowObjects ) ];
                            } else {
                                newRows = newRows.concat( data.rowObjects );
                            }
                            childDataAppended = true;
                        } else { // If already expanded, need to remove existing childs/sub before adding new set of childrens
                            alreadyExpandedParents.push( obj.occurrence.uid );
                        }
                    }
                } );
                if( !childDataAppended ) {
                    newRows = newRows.concat( data.rowObjects ); // Append at the end
                }
                data.rowObjects = changeIsPreviousHiddenFlag( newRows );
                _data.rowObjects = data.rowObjects;
                parentRowUid = null;
                if( MatrixContext ) {
                    MatrixContext.parentRows = data.rowObjects;
                    appCtxService.updateCtx( 'MatrixContext', MatrixContext );
                }
            }

            if( appCtxService.ctx.MatrixContext.parentCols && !parentColUid ) {
                if( !noSortCol ) {
                    // row was expanded so keep old columns
                    data.colObjects = appCtxService.ctx.MatrixContext.parentCols;
                    _data.colObjects = data.colObjects;
                }
                // check response cols for expanded parents
                // Calculating expanded rows/cols not required for in case of sort
                if( !( noSortCol || noSortRow || appCtxService.ctx.MatrixContext.sortRow || appCtxService.ctx.MatrixContext.sortCol ) ) {
                    var lastRowObj;
                    var allExpandedRows = [];
                    _.forEach( data.rowObjects, function( obj ) {
                        if( lastRowObj && lastRowObj.occurrence && lastRowObj.occurrence.uid === obj.parentUid ) {
                            lastRowObj.isExpanded = true; // Mark as expanded as chids are expanded. case added for expand all/level
                            allExpandedRows.push( lastRowObj.occurrence.uid );
                        }
                        lastRowObj = obj;
                    } );
                    appCtxService.registerPartialCtx( 'MatrixContext.expandedRows', allExpandedRows );
                }
            }
            if( parentColUid ) {
                var newCols = [];
                var alreadyExpandedParents1 = [];
                var childDataAppended1 = false;
                _.forEach( appCtxService.ctx.MatrixContext.parentCols, function( obj ) {
                    if( !alreadyExpandedParents1.includes( obj.parentUid ) ) {
                        if( alreadyExpandedParents1.length > 0 ) { // concate childs (from server) after removing/skipping all childs
                            newCols = newCols.concat( data.colObjects );
                            childDataAppended1 = true;
                        }
                        newCols.push( obj );
                        alreadyExpandedParents1 = [];
                    } else if( obj.occurrence ) {
                        alreadyExpandedParents1.push( obj.occurrence.uid ); // Need to check all child, to remove/skip sub childs
                    }

                    if( obj.occurrence && obj.occurrence.uid === parentColUid ) {
                        if( !obj.isExpanded ) { // If already not expanded
                            obj.isExpanded = true;
                            // This is the tracelink count sort
                            if( individualRowSort && individualRowSortType === 'ASC' || individualRowSortType === 'DESC' ) {
                                newCols = [ ...newCols, ..._sortColObjectsWithTracelinkCount( data.colObjects ) ];
                            } else {
                                newCols = newCols.concat( data.colObjects );
                            }
                            childDataAppended1 = true;
                        } else { // If already expanded, need to remove existing childs/sub before adding new set of childrens
                            alreadyExpandedParents1.push( obj.occurrence.uid );
                        }
                    }
                } );
                if( !childDataAppended1 ) {
                    newCols = newCols.concat( data.colObjects ); // Append at the end
                }
                data.colObjects = changeIsPreviousHiddenFlag( newCols );
                _data.colObjects = data.colObjects;
                parentColUid = null;
                if( MatrixContext ) {
                    MatrixContext.parentCols = data.colObjects;
                    appCtxService.updateCtx( 'MatrixContext', MatrixContext );
                }
            }

            // Calculating expanded rows/cols not required for in case of sort
            if( appCtxService.ctx.MatrixContext.parentRows && !parentRowUid && !( noSortCol || noSortRow || appCtxService.ctx.MatrixContext.sortRow || appCtxService.ctx.MatrixContext.sortCol ) ) {
                // check response cols for expanded parents
                var allExpandedCols = [];
                var lastColObj;
                _.forEach( data.colObjects, function( obj ) {
                    if( lastColObj && lastColObj.occurrence && lastColObj.occurrence.uid === obj.parentUid ) {
                        lastColObj.isExpanded = true; // Mark as expanded as chids are expanded. case added for expand all/level
                        allExpandedCols.push( lastColObj.occurrence.uid );
                    }
                    lastColObj = obj;
                } );
                appCtxService.registerPartialCtx( 'MatrixContext.expandedCols', allExpandedCols );
            }

            data.targetParentObjectInfo = '';
            data.srcParentObjectInfo = '';
        }

        data.dispatch( { path: 'data.rowObjects', value: data.rowObjects } );
        data.dispatch( { path: 'data.colObjects', value: data.colObjects } );
        data.dispatch( { path: 'data.targetParentObjectInfo', value: '' } );
        data.dispatch( { path: 'data.srcParentObjectInfo', value: '' } );
        /*
         * IMPORTANT : preserve original source and target objects in tree mode
         */
        if( !appCtxService.ctx.MatrixContext.peakSrcInfo ) {
            MatrixContext.peakSrcInfo = data.srcObjectInfo;
            MatrixContext.peakTargetInfo = data.targetObjectInfo;
            appCtxService.updateCtx( 'MatrixContext', MatrixContext );
        }

        if( appCtxService.ctx.tlmTreeMode ) {
            data.srcObjectInfo = appCtxService.ctx.MatrixContext.peakSrcInfo;
            data.targetObjectInfo = appCtxService.ctx.MatrixContext.peakTargetInfo;
            data.dispatch( { path: 'data.srcObjectInfo', value: appCtxService.ctx.MatrixContext.peakSrcInfo } );
            data.dispatch( { path: 'data.targetObjectInfo', value: appCtxService.ctx.MatrixContext.peakTargetInfo } );
        }

        if( evtDataIndividualRowSort || evtDataIndividualColSort ) {
            sortAndFilterEmpties( data, appCtxService.ctx );
        }

        registerCtxIfHiddenObjPresent( data );
        processData( data, appCtxService.ctx );
        if( !appCtxService.ctx.MatrixReset ) {
            reqTraceabilityMatrixService.renderMatrixSelection( data );
        } else {
            appCtxService.unRegisterCtx( 'MatrixReset' );
        }
    }
    return;
};

/**
 * Add up the number of links for each row and column. Set the totalLinkCount of row and
 * column objects.
 * @param {object} data Contains row, column and tracelink information
 */
var calculateLinkCounts = function( data ) {
    var rowLinks = new Map();
    var colLinks = new Map();
    _.forEach( data.tracelinkInfo, function( linkObj ) {
        var rowVal = rowLinks.get( linkObj.rowObject.uid );
        var colVal = colLinks.get( linkObj.colObject.uid );
        rowLinks.set( linkObj.rowObject.uid, rowVal ? rowVal + linkObj.numLinks : linkObj.numLinks );
        colLinks.set( linkObj.colObject.uid, colVal ? colVal + linkObj.numLinks : linkObj.numLinks );
    } );
    _.forEach( data.rowObjects, function( obj ) {
        var cnt = rowLinks.get( obj.occurrence && obj.occurrence.uid );
        obj.totalLinkCnt = cnt ? cnt : 0;
    } );
    _.forEach( data.colObjects, function( obj ) {
        var cnt = colLinks.get( obj.occurrence && obj.occurrence.uid );
        obj.totalLinkCnt = cnt ? cnt : 0;
    } );
};

/**
 * Filter out the rows and columns with no tracelinks.
 * @param {object} data Contains row and column information
 * @param {object} ctx matrix context
 */
var sortAndFilterEmpties = function( data, ctx ) {
    // if empty rows/columns are rmoved from view model a copy is needed
    // so no server call is required for restore
    if( useCachedData ) {
        // remove empty rows/columns turned off, restore complete data
        data.rowObjects = cachedRows;
        data.colObjects = cachedCols;
        useCachedData = false;
    }

    var sortRow = appCtxService.ctx.MatrixContext.sortRow;
    var sortCol = appCtxService.ctx.MatrixContext.sortCol;
    if( !showEmptyRowsandColsActionState || sortRow || sortCol ) {
        calculateLinkCounts( data );
    }

    if( showEmptyRowsandColsActionState ) {
        cachedRows = data.rowObjects;
        cachedCols = data.colObjects;
    } else {
        // filter empty rows and columng
        var filteredRows = [];
        _.forEach( data.rowObjects, function( obj ) {
            if( obj.totalLinkCnt > 0 ) {
                filteredRows.push( obj );
            }
        } );
        data.rowObjects = filteredRows;
        var filteredCols = [];
        _.forEach( data.colObjects, function( obj ) {
            if( obj.totalLinkCnt > 0 ) {
                filteredCols.push( obj );
            }
        } );
        data.colObjects = filteredCols;
    }

    let maxLevel = 0;

    // apply sort
    if( sortRow === 'total' ) {
        data.rowObjects.sort( function( a, b ) {
            return b.totalLinkCnt - a.totalLinkCnt;
        } );
        data.rowObjects = changeIsPreviousHiddenFlag( data.rowObjects );
    } else if( sortRow ) {
        // Descending Sort
        if( individualColSort && individualColSortType === 'DESC' ) {
            data.rowObjects.sort( function( a, b ) {
                if( appCtxService.ctx.tlmTreeMode ) {
                    maxLevel = _calculuateMaxLevelHierahchy( a, b, maxLevel );
                }

                var link1 = cellDataMap[ a.occurrence && a.occurrence.uid.concat( '+' ).concat( sortRow ) ];
                var link2 = cellDataMap[ b.occurrence && b.occurrence.uid.concat( '+' ).concat( sortRow ) ];
                return ( link2 ? link2.numOfLinksOnChildren : 0 ) - ( link1 ? link1.numOfLinksOnChildren : 0 );
            } );
        }
        // Ascending Sort
        if( individualColSort && individualColSortType === 'ASC' ) {
            data.rowObjects.sort( function( a, b ) {
                if( appCtxService.ctx.tlmTreeMode ) {
                    maxLevel = _calculuateMaxLevelHierahchy( a, b, maxLevel );
                }

                var link1 = cellDataMap[ a.occurrence && a.occurrence.uid.concat( '+' ).concat( sortRow ) ];
                var link2 = cellDataMap[ b.occurrence && b.occurrence.uid.concat( '+' ).concat( sortRow ) ];
                return ( link1 ? link1.numOfLinksOnChildren : 0 ) - ( link2 ? link2.numOfLinksOnChildren : 0 );
            } );
        }

        if( maxLevel ) {
            data.rowObjects = _globalSortForTracelinkCount( [ ...data.rowObjects ], maxLevel );
        }
        data.rowObjects = changeIsPreviousHiddenFlag( data.rowObjects );
    }
    if( sortCol === 'total' ) {
        data.colObjects.sort( function( a, b ) {
            return b.totalLinkCnt - a.totalLinkCnt;
        } );
        data.colObjects = changeIsPreviousHiddenFlag( data.colObjects );
    } else if( sortCol ) {
        // Descending Sort
        if( individualRowSort && individualRowSortType === 'DESC' ) {
            data.colObjects.sort( function( a, b ) {
                if( appCtxService.ctx.tlmTreeMode ) {
                    maxLevel = _calculuateMaxLevelHierahchy( a, b, maxLevel );
                }

                var link1 = cellDataMap[ sortCol.concat( '+' ).concat( a.occurrence && a.occurrence.uid ) ];
                var link2 = cellDataMap[ sortCol.concat( '+' ).concat( b.occurrence && b.occurrence.uid ) ];
                return ( link2 ? link2.numOfLinksOnChildren : 0 ) - ( link1 ? link1.numOfLinksOnChildren : 0 );
            } );
        }
        // Ascending Sort
        if( individualRowSort && individualRowSortType === 'ASC' ) {
            data.colObjects.sort( function( a, b ) {
                if( appCtxService.ctx.tlmTreeMode ) {
                    maxLevel = _calculuateMaxLevelHierahchy( a, b, maxLevel );
                }

                var link1 = cellDataMap[ sortCol.concat( '+' ).concat( a.occurrence && a.occurrence.uid ) ];
                var link2 = cellDataMap[ sortCol.concat( '+' ).concat( b.occurrence && b.occurrence.uid ) ];
                return ( link1 ? link1.numOfLinksOnChildren : 0 ) - ( link2 ? link2.numOfLinksOnChildren : 0 );
            } );
        }
        if( maxLevel ) {
            data.colObjects = _globalSortForTracelinkCount( [ ...data.colObjects ], maxLevel );
        }
        data.colObjects = changeIsPreviousHiddenFlag( data.colObjects );
    }
    data.dispatch( { path: 'data.rowObjects', value: data.rowObjects } );
    data.dispatch( { path: 'data.colObjects', value: data.colObjects } );
};

/**
 * Function to apply setting to re-generate Tracelability Matrix
 *
 * Important: open panel with ctx parameter so that the panel is popualted with the current states of ctx engine.
 *
 * @param {DeclViewModel} data - The declViewModel data context object.
 */
export let applyMatrixSettings = function( data, ctx ) {
    settingPropertiesToBeShown = [];
    for( let index = 0; index < data.matrixSettingProperties.length; index++ ) {
        const prop = data.matrixSettingProperties[ index ];
        if( prop.dbValue ) {
            settingPropertiesToBeShown.push( prop.propertyName );
        }
    }
    appCtxService.registerCtx( 'showTracelinkDirection', data.showTracelinkDirection.dbValue );

    eventBus.publish( 'Arm0Traceability.applyMatrixSettings', appCtxService.ctx );
};

/**
 * Capture serviceData from  SOA. It contains property values needed for
 * changing row/col header display names.
 * Important: This only gets called when on nagivate because it needs child uids.
 * Important2: The way this component was designed does not allow passing the service data directly
 *  This uses workaround to store service data as global and global is read afterwards in processData phase.
 * Todo: Fix this: We need better soa call to avoid the global workaround.
 * @param {object} serviceData Service data
 */
export let setServiceData = function( serviceData ) {
    getChildMatrixServiceData = serviceData.modelObjects;
};

var settingProperties = {};
var settingPropertiesToBeShown = [];

export let getSettingProperties = function( data ) {
    var properties = [];
    // Show Name as selected, if no property selected from setting panel
    if( settingPropertiesToBeShown.length === 0 ) {
        settingPropertiesToBeShown.push( 'object_name' );
    }
    // settingProperties can be empty in case saved matrix (old data)
    // ID, Name, Owning_User will be default setting properties
    var defaultProps = {
        item_id: data.i18n.id,
        object_name: data.i18n.name,
        owning_user: data.i18n.owner
    };

    var propertiesNameValueMap = Object.keys( settingProperties ).length === 0 ? defaultProps : settingProperties;

    var propertyList = [];
    var matrixSettingsProperties = appCtxService.getCtx( 'preferences.REQ_Matrix_Settings_Properties' );
    // This is required to show properties in the same sequence as preference
    if( matrixSettingsProperties && matrixSettingsProperties.length > 0 ) {
        matrixSettingsProperties.forEach( objProp => {
            propertyList.push( objProp.split( ':' )[ 1 ] );
        } );
        propertyList = propertyList.filter( uid => Object.keys( propertiesNameValueMap ).includes( uid ) );
    }
    if( propertyList.length === 0 ) {
        propertyList = Object.keys( propertiesNameValueMap ).sort();
    }

    propertyList.forEach( propName => {
        let prop = {
            displayName: propertiesNameValueMap[ propName ],
            type: 'BOOLEAN',
            isRequired: 'false',
            isEditable: 'true',
            dbValue: settingPropertiesToBeShown.includes( propName ),
            dispValue: propertiesNameValueMap[ propName ],
            labelPosition: 'PROPERTY_LABEL_AT_RIGHT',
            propName: propName
        };
        properties.push( modelPropertySvc.createViewModelProperty( prop ) );
    } );
    return properties;
};

export let getSettingPropertiesToBeShown = function() {
    return settingPropertiesToBeShown;
};

var _getSettingProperty = function( object, propertyName ) {
    var property;
    if( object.propInfoVec ) {
        for( let index = 0; index < object.propInfoVec.length; index++ ) {
            const prop = object.propInfoVec[ index ];
            if( prop.propName === propertyName ) {
                property = prop;
                break;
            }
        }
    }
    return property;
};

var _updateSettingPropertyValue = function( object, propertyName, updatedPropValue ) {
    var property;
    if( object.propInfoVec ) {
        for( let index = 0; index < object.propInfoVec.length; index++ ) {
            const prop = object.propInfoVec[ index ];
            if( prop.propName === propertyName && prop.propValues[ 0 ] !== updatedPropValue ) {
                prop.propValues[ 0 ] = updatedPropValue;
                if( propertyName === 'object_name' ) {
                    object.name = updatedPropValue;
                }
                property = prop;
                break;
            }
        }
    }
    return property;
};

/**
 * Adds properties that may be used as different labels for rows and columns headers
 * For each row object include the parent, id, and owner. Do the same for columns.
 *
 * @param {object} data view model
 */
var applyServiceData = function( data ) {
    var objectsToBeLoaded = [];

    data.dispatch( { path: 'data.rowObjects', value: data.rowObjects } );
    data.dispatch( { path: 'data.colObjects', value: data.colObjects } );
    _.forEach( data.rowObjects, function( obj ) {
        if( obj.parentOccurrence && obj.parentOccurrence.uid !== 'AAAAAAAAAAAAAA' ) {
            obj.parentUid = obj.parentOccurrence.uid;
        }
        obj.name = obj.name ? obj.name : obj.displayName;
        obj.propInfoVec && obj.propInfoVec.forEach( prop => {
            if( !( prop.propName in settingProperties ) ) {
                settingProperties[ prop.propName ] = prop.displayName;
            }
        } );
        if( obj.occurrence && obj.occurrence.uid && obj.occurrence.uid !== 'AAAAAAAAAAAAAA' ) {
            var mo = cdm.getObject( obj.occurrence.uid );
            if( ( !mo || _.isEmpty( mo.props ) ) && !objectsToBeLoaded.includes( obj.occurrence ) ) {
                objectsToBeLoaded.push( obj.occurrence );
            }
        }
    } );

    _.forEach( data.colObjects, function( obj ) {
        if( obj.parentOccurrence && obj.parentOccurrence.uid !== 'AAAAAAAAAAAAAA' ) {
            obj.parentUid = obj.parentOccurrence.uid;
        }
        obj.name = obj.name ? obj.name : obj.displayName;
        obj.propInfoVec && obj.propInfoVec.forEach( prop => {
            if( !( prop.propName in settingProperties ) ) {
                settingProperties[ prop.propName ] = prop.displayName;
            }
        } );
        if( obj.occurrence && obj.occurrence.uid && obj.occurrence.uid !== 'AAAAAAAAAAAAAA' ) {
            var mo = cdm.getObject( obj.occurrence.uid );
            if( ( !mo || _.isEmpty( mo.props ) ) && !objectsToBeLoaded.includes( obj.occurrence ) ) {
                objectsToBeLoaded.push( obj.occurrence );
            }
        }
    } );
    _.defer( function() {
        if( objectsToBeLoaded.length > 0 ) {
            //ensure the property loaded
            var propertyPolicyOverride = {
                types: [ {
                    name: 'ItemRevision',
                    properties: [ {
                        name: 'item_id'
                    } ]
                },
                {
                    name: 'WorkspaceObject',
                    properties: [ {
                        name: 'object_name'
                    },
                    {
                        name: 'owning_user'
                    },
                    {
                        name: 'awp0CellProperties'
                    },
                    {
                        name: 'object_string'
                    }
                    ]
                },
                {
                    name: 'Awb0Element',
                    properties: [ {
                        name: 'awb0UnderlyingObject',
                        modifiers: [ {
                            name: 'withProperties',
                            Value: 'true'
                        } ]
                    },
                    {
                        name: 'awb0Parent'
                    },
                    {
                        name: 'object_string'
                    },
                    {
                        name: 'awp0CellProperties'
                    },
                    {
                        name: 'awb0NumberOfChildren'
                    }
                    ]
                }

                ]
            };

            var headerStateOverride = { usePolicyOnly: true };
            soaSvc.post( 'Core-2006-03-DataManagement', 'getProperties', {
                objects: objectsToBeLoaded,
                attributes: Object.keys( settingProperties ).length > 0 ? Object.keys( settingProperties ) : [ 'object_name', 'item_id', 'owning_user' ]
            }, propertyPolicyOverride, false, headerStateOverride );
            // dmSvc.loadObjects( objectsToBeLoaded );
        }
    } );
    data.dispatch( { path: 'data.rowObjects', value: data.rowObjects } );
    data.dispatch( { path: 'data.colObjects', value: data.colObjects } );
};

/**
 * special case for fruit rollup matrix
 *
 * @param {object} data view model
 */
var applyFullRollupServiceData = function( data ) {
    _.forEach( data.rowObjects, function( obj ) {
        obj.name = obj.name ? obj.name : obj.displayName;
    } );

    _.forEach( data.colObjects, function( obj ) {
        obj.name = obj.name ? obj.name : obj.displayName;
    } );
    data.dispatch( { path: 'data.rowObjects', value: data.rowObjects } );
    data.dispatch( { path: 'data.colObjects', value: data.colObjects } );
};

/**
 * Reset cached information related to full sort and remove emtpy rows and columns
 * @param {object} ctx matrix context
 *
 */
var resetFullDataCache = function() {
    cachedRows = {};
    cachedCols = {};
    useCachedData = false;
    haveFullData = false;
    var MatrixContext = appCtxService.getCtx( 'MatrixContext' );
    if( MatrixContext ) {
        MatrixContext.sortRow = null;
        MatrixContext.sortCol = null;
        appCtxService.updateCtx( 'MatrixContext', MatrixContext );
    }
    showEmptyRowsandColsActionState = true;
};

/**
 * Contructs the cell data map with key as combination of column and row uid
 * @param {Object} data - The panel's view model object
 * @param {object} tracelinkInfo Info about trace links between structures
 * @return {Object} cellData of a grid
 */
var getCellMap = function( data, tracelinkInfo ) {
    var cellDataMap = {};
    if( tracelinkInfo ) {
        _.forEach( tracelinkInfo, function( traceLinkObj ) {
            var mapKey = traceLinkObj.rowObject.uid;
            mapKey = mapKey.concat( '+' ).concat( traceLinkObj.colObject.uid );
            var reverseMapKey = traceLinkObj.colObject.uid.concat( '+' ).concat( traceLinkObj.rowObject.uid );
            cellDataMap[ mapKey ] = traceLinkObj;
            traceLinkObj.numLinks = traceLinkObj.numOfLinksOnChildren;

            traceLinkObj.definingLinksInfo.forEach( function( linkInfo ) {
                if( tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ] &&
                    !tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ].includes( mapKey ) ) {
                    tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ].push( mapKey );
                    tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ].push( reverseMapKey );
                    tltotypeMap.set( linkInfo.tracelink.uid, linkInfo.tracelink.type );
                } else if( tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ] ) {
                    tltotypeMap.set( linkInfo.tracelink.uid, linkInfo.tracelink.type );
                } else {
                    tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ] = [ mapKey, reverseMapKey ];
                    addInTracelinkIDVsPersistentObjMap( linkInfo );
                    tltotypeMap.set( linkInfo.tracelink.uid, linkInfo.tracelink.type );
                }

                if( tlTypeListIn.indexOf( linkInfo.tracelink.type ) === -1 ) {
                    tlTypeListIn.push( linkInfo.tracelink.type );
                }
            } );
            traceLinkObj.complyingLinksInfo.forEach( function( linkInfo ) {
                if( tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ] &&
                    !tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ].includes( mapKey ) ) {
                    tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ].push( mapKey );
                    tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ].push( reverseMapKey );
                    tltotypeMap.set( linkInfo.tracelink.uid, linkInfo.tracelink.type );
                } else if( tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ] ) {
                    tltotypeMap.set( linkInfo.tracelink.uid, linkInfo.tracelink.type );
                } else {
                    tracelinkIDVsMatrixCell[ linkInfo.tracelink.uid ] = [ mapKey, reverseMapKey ];
                    addInTracelinkIDVsPersistentObjMap( linkInfo );
                    tltotypeMap.set( linkInfo.tracelink.uid, linkInfo.tracelink.type );
                }

                if( tlTypeListIn.indexOf( linkInfo.tracelink.type ) === -1 ) {
                    tlTypeListIn.push( linkInfo.tracelink.type );
                }
            } );
        } );
    }
    data.tlTypeList = listBoxService.createListModelObjectsFromStrings( tlTypeListIn );
    data.dispatch( { path: 'data.tlTypeList', value: data.tlTypeList } );
    tlTypeList = data.tlTypeList;
    return cellDataMap;
};

let addInTracelinkIDVsPersistentObjMap = function( linkInfo ) {
    var p = linkInfo.primary ? linkInfo.primary.uid : undefined;
    var s = linkInfo.secondary ? linkInfo.secondary.uid : undefined;
    if( linkInfo.primary && linkInfo.primary.modelType && linkInfo.primary.modelType.typeHierarchyArray && linkInfo.primary.modelType.typeHierarchyArray.indexOf( 'Awb0ConditionalElement' ) >= 0 ) {
        p = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( linkInfo.primary.uid ) ).uid;
    }
    if( linkInfo.secondary && linkInfo.secondary.modelType && linkInfo.secondary.modelType.typeHierarchyArray && linkInfo.secondary.modelType.typeHierarchyArray.indexOf( 'Awb0ConditionalElement' ) >=
        0 ) {
        s = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( linkInfo.secondary.uid ) ).uid;
    }
    if( p && s ) {
        if( !tracelinkIDVsPersistentObjMatrixCell[ linkInfo.tracelink.uid ] ) {
            tracelinkIDVsPersistentObjMatrixCell[ linkInfo.tracelink.uid ] = [ p, s ];
        }
    }
};

export let getLinkTypes = function() {
    var tltypeCountMap = {};
    for( let [ uid, type ] of tltotypeMap.entries() ) {
        // Check if tracelinked row/columns is still available in matrix data, it may be filtered out.
        var rowColUid = tracelinkIDVsPersistentObjMatrixCell[ uid ];
        if( rowColUid ) {
            var rowUid = rowColUid[ 0 ];
            var colUid = rowColUid[ 1 ];
            if( !isObjectPresentInGivenList( rowUid, _data.rowObjects ) ) {
                continue;
            }
            if( !isObjectPresentInGivenList( colUid, _data.colObjects ) ) {
                continue;
            }
        }
        if( !tltypeCountMap[ type ] ) {
            tltypeCountMap[ type ] = 1;
        } else {
            tltypeCountMap[ type ] = 1 + tltypeCountMap[ type ];
        }
    }
    return {
        tlTypeList: tlTypeList,
        tltypeCountMap: tltypeCountMap,
        tltotypeMap: tltotypeMap,
        tlTypeListIn: listBoxService.createListModelObjectsFromStrings( tlTypeListIn )
    };
};

var isObjectPresentInGivenList = function( uid, objectList ) {
    var found = false;
    for( let index = 0; index < objectList.length; index++ ) {
        const obj = objectList[ index ];
        if( obj.persistentObject && obj.persistentObject.uid === uid ) {
            found = true;
            break;
        }
    }
    return found;
};

/**
 * Build string to display in cell
 * @param {object} linkInfo trace link information
 * @param {boolean} show trace link count is true if show child rollup count is toggle which suppresses arrows
 * @return {String} cell display value
 */
var getCellValue = function( linkInfo, showCount ) {
    var cellValue = '';
    if( linkInfo ) {
        if( !showCount && !_data.showFullRollupCase && linkInfo.numOfLinksOnChildren > 0 ) {
            if( linkInfo.tracelinkDirection === 'Complying' ) {
                cellValue = 'COMPLYING';
            } else if( linkInfo.tracelinkDirection === 'Defining' ) {
                cellValue = 'DEFINING';
            } else if( linkInfo.tracelinkDirection === 'Both' ) {
                cellValue = 'BOTH';
            }
        }
        if( linkInfo.numOfLinksOnChildren > 0 ) {
            cellValue += linkInfo.numOfLinksOnChildren;
        }
    }
    return cellValue;
};

/**
 * refreshTraceabilityMatrix
 */
export let refreshTraceabilityMatrix = function() {
    eventBus.publish( 'requirementDocumentation.navigate', {} );
};

/**
 *  Update tracelink matrix ino locally on creation of new tracelink
 *
 * @param {object} data view model
 * @param {object} primObj primary object
 * @param {object} secObj secondary object
 * @param {object} relationObj relation object
 *
 */
var _cacheNewTracelinkCreated = function( data, primObj, secObj, relationObj ) {
    data.cacheTracelinks = {};
    var linkInfo = {};
    linkInfo.primaryObjectPropInfo = [];
    linkInfo.secObjectPropInfo = [];
    linkInfo.tracelinkPropInfo = [];
    linkInfo.tracelinkType = relationObj.props.relation_type.uiValues[ 0 ];
    var primRev;
    if( primObj.modelType.typeHierarchyArray.indexOf( 'Awb0ConditionalElement' ) === -1 ) {
        var obj = { propValues: [ primObj.props.object_name.dbValues[ 0 ] ] };
        primObj.elementUid = data.tracelinkSourceObject.revisionUid === primObj.uid ? data.tracelinkSourceObject.elementUid : data.tracelinkDestinationObject.elementUid;
        if( primObj.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
            primObj.elementUid = revToOccMap[ primObj.uid ];
        }
    } else {
        primRev = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( primObj.uid ) );
        obj = { propValues: [ primRev.props.object_name.dbValues[ 0 ] ] };
    }

    var primaryObjectPropInfo1 = obj;

    var primaryObjectPropInfo2 = {
        propValues: [
            primRev ? primRev.modelType.displayName : primObj.modelType.displayName
        ]
    };

    var secRev;
    if( secObj.modelType.typeHierarchyArray.indexOf( 'Awb0ConditionalElement' ) === -1 ) {
        obj = { propValues: [ secObj.props.object_name.dbValues[ 0 ] ] };
        secObj.elementUid = data.tracelinkSourceObject.revisionUid === secObj.uid ? data.tracelinkSourceObject.elementUid : data.tracelinkDestinationObject.elementUid;
        if( secObj.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
            secObj.elementUid = revToOccMap[ secObj.uid ];
        }
    } else {
        secRev = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( secObj.uid ) );
        obj = { propValues: [ secRev.props.object_name.dbValues[ 0 ] ] };
    }
    var secObjectPropInfo1 = obj;
    var secObjectPropInfo2 = {
        propValues: [ secRev ? secRev.modelType.displayName : secObj.modelType.displayName ]
    };

    var tracelinkPropInfo = {
        name: 'name',
        propValues: [ relationObj.props.object_string.uiValues[ 0 ] ]
    };

    linkInfo.primaryObjectPropInfo.push( primaryObjectPropInfo1 );
    linkInfo.primaryObjectPropInfo.push( primaryObjectPropInfo2 );
    linkInfo.secObjectPropInfo.push( secObjectPropInfo1 );
    linkInfo.secObjectPropInfo.push( secObjectPropInfo2 );
    linkInfo.tracelinkPropInfo.push( tracelinkPropInfo );
    linkInfo.tracelinkDirection = 'Complying';
    linkInfo.tracelink = relationObj;
    var key = ( primObj.elementUid || primObj.uid ).concat( '+' ).concat( secObj.elementUid || secObj.uid );
    var arrCachedTracelink = data.cacheTracelinks[ key ];

    if( !arrCachedTracelink ) {
        arrCachedTracelink = {};
    }

    arrCachedTracelink = linkInfo;
    data.cacheTracelinks[ key ] = arrCachedTracelink;

    var keyReverse = ( secObj.elementUid || secObj.uid ).concat( '+' ).concat( primObj.elementUid || primObj.uid );
    arrCachedTracelink = data.cacheTracelinks[ keyReverse ];

    if( !arrCachedTracelink ) {
        arrCachedTracelink = {};
    }

    var deepCopiedLinkInfo = _.cloneDeep( linkInfo );
    deepCopiedLinkInfo.tracelinkDirection = 'Defining';
    deepCopiedLinkInfo.primaryObjectPropInfo = [];
    deepCopiedLinkInfo.secObjectPropInfo = [];
    deepCopiedLinkInfo.primaryObjectPropInfo.push( secObjectPropInfo1 );
    deepCopiedLinkInfo.primaryObjectPropInfo.push( secObjectPropInfo2 );

    deepCopiedLinkInfo.secObjectPropInfo.push( primaryObjectPropInfo1 );
    deepCopiedLinkInfo.secObjectPropInfo.push( primaryObjectPropInfo2 );

    arrCachedTracelink = deepCopiedLinkInfo;
    data.cacheTracelinks[ keyReverse ] = arrCachedTracelink;

    pushNewLink( key, data, primObj, secObj, linkInfo );
    pushNewLink( keyReverse, data, secObj, primObj, deepCopiedLinkInfo );
    _updateParentLinkOnTracelinkCreate( data, primObj, secObj, linkInfo, deepCopiedLinkInfo );
};

/**
 * pushNewLink
 *
 * @param {Object}
 *            key key
 * @param {Object}
 *            data data
 * @param {Object}
 *            primObj primObj
 * @param {Object}
 *            secObj secObj
 * @param {Object}
 *            linkInfo linkInfo
 */
var pushNewLink = function( key, data, primObj, secObj, linkInfo ) {
    var found = false;
    if( cellDataMap[ key ] ) {
        var matrixObject = cellDataMap[ key ];
        matrixObject.numOfLinksOnChildren += 1;
        if( data.cacheTracelinks[ key ] && data.cacheTracelinks[ key ].tracelinkDirection === 'Complying' ) {
            cellDataMap[ key ].complyingLinksInfo.push( data.cacheTracelinks[ key ] );
        } else if( data.cacheTracelinks[ key ] && data.cacheTracelinks[ key ].tracelinkDirection === 'Defining' ) {
            cellDataMap[ key ].definingLinksInfo.push( data.cacheTracelinks[ key ] );
        }
        if( cellDataMap[ key ].tracelinkDirection === '' ) {
            cellDataMap[ key ].tracelinkDirection = linkInfo.tracelinkDirection;
        }
        if( cellDataMap[ key ].tracelinkDirection !== linkInfo.tracelinkDirection ) {
            cellDataMap[ key ].tracelinkDirection = 'Both';
        }
        found = true;
    }

    if( !found ) {
        var matrixCellInfo = getMatrixCellInfoObject( primObj, secObj, linkInfo.tracelinkDirection, linkInfo );
        data.tracelinkInfo.push( matrixCellInfo );
        tltotypeMap.set( linkInfo.tracelink.uid, linkInfo.tracelink.type );
        if( tlTypeListIn.indexOf( data.eventData.relationObjects[ 0 ].modelType.name ) === -1 ) {
            tlTypeListIn.push( data.eventData.relationObjects[ 0 ].modelType.name );
        }
        data.tlTypeList = listBoxService.createListModelObjectsFromStrings( tlTypeListIn );
        data.dispatch( { path: 'data.tlTypeList', value: data.tlTypeList } );
        tlTypeList = data.tlTypeList;
    }
};

//update parent count when tracelink created for Full-Rollup Matrix
var _updateParentLinkOnTracelinkCreate = function( data, primObj, secObj, linkInfo, deepCopiedLinkInfo ) {
    if( data.matrixType === 'Full-Rollup Matrix' ) {
        var parentsRowobject = data.rowObjects;
        var parentsColobject = data.colObjects;

        if( parentsRowobject !== null && parentsColobject !== null ) {
            var peakSrc = appCtxService.getCtx( 'MatrixContext' ).peakSrcInfo;
            var targetSrc = appCtxService.getCtx( 'MatrixContext' ).peakTargetInfo;
            var GrandparentRow = _getGrandParent( primObj, secObj, parentsRowobject, peakSrc, targetSrc );
            var Grandparentcol = _getGrandParent( secObj, primObj, parentsColobject, peakSrc, targetSrc );

            if( ( GrandparentRow.uid !== primObj.uid && Grandparentcol.uid !== secObj.uid ||
                    GrandparentRow.uid === primObj.uid && Grandparentcol.uid !== secObj.uid ||
                    GrandparentRow.uid !== primObj.uid && Grandparentcol.uid === secObj.uid ) &&
                ( GrandparentRow.uid !== secObj.uid && Grandparentcol.uid !== primObj.uid ||
                    GrandparentRow.uid === secObj.uid && Grandparentcol.uid !== primObj.uid ||
                    GrandparentRow.uid !== secObj.uid && Grandparentcol.uid === primObj.uid )

            ) {
                var key = GrandparentRow.uid.concat( '+' ).concat( Grandparentcol.uid );
                var arrCachedTracelink = data.cacheTracelinks[ key ];

                if( !arrCachedTracelink ) {
                    arrCachedTracelink = {};
                }

                arrCachedTracelink = linkInfo;
                data.cacheTracelinks[ key ] = arrCachedTracelink;

                var keyReverse = Grandparentcol.uid.concat( '+' ).concat( GrandparentRow.uid );
                arrCachedTracelink = data.cacheTracelinks[ keyReverse ];

                if( !arrCachedTracelink ) {
                    arrCachedTracelink = {};
                }
                arrCachedTracelink = deepCopiedLinkInfo;
                data.cacheTracelinks[ keyReverse ] = arrCachedTracelink;

                pushNewLink( key, data, GrandparentRow, Grandparentcol, linkInfo );
                pushNewLink( keyReverse, data, Grandparentcol, GrandparentRow, deepCopiedLinkInfo );
            }
        }
    }
};

//To find out Uppermost parent of child where tracelink is created  for Full-Rollup Matrix
var _getGrandParent = function( primObj, secObj, AllParentobject, peakSrc, targetSrc ) {
    for( var index = 0; index < AllParentobject.length; index++ ) {
        if( AllParentobject[ index ].occurrence.uid === primObj.uid || AllParentobject[ index ].occurrence.uid === secObj.uid ) {
            var parentObject = cdm.getObject( AllParentobject[ index ].parentUid );
            if( peakSrc.occurrence.uid === AllParentobject[ index ].parentUid || targetSrc.occurrence.uid === AllParentobject[ index ].parentUid ) {
                parentObject = cdm.getObject( AllParentobject[ index ].occurrence.uid );
                return parentObject;
            }
            return _getGrandParent( parentObject, secObj, AllParentobject, peakSrc, targetSrc );
        }
    }
};

/**
 * getMatrixCellInfoObject
 *
 * @param {Object}
 *            primaryObject primaryObject
 * @param {Object}
 *            secondaryObject secondaryObject
 * @param {Object}
 *            tracelinkDirection tracelinkDirection
 * @param {Object}
 *            linkInfo linkInfo
 * @return {Array}
 *            newTracelinkInfo
 */
var getMatrixCellInfoObject = function( primaryObject, secondaryObject, tracelinkDirection, linkInfo ) {
    var newTracelinkInfo = {};
    newTracelinkInfo.rowObject = {
        uid: primaryObject.elementUid || primaryObject.uid
    };
    newTracelinkInfo.colObject = {
        uid: secondaryObject.elementUid || secondaryObject.uid
    };
    newTracelinkInfo.tracelinkDirection = tracelinkDirection;
    var p = linkInfo.primary;
    var s = linkInfo.secondary;
    if( primaryObject.modelType.typeHierarchyArray.indexOf( 'Awb0ConditionalElement' ) >= 0 ) {
        p = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( primaryObject.uid ) );
    }
    if( secondaryObject.modelType.typeHierarchyArray.indexOf( 'Awb0ConditionalElement' ) >= 0 ) {
        s = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( secondaryObject.uid ) );
    }
    linkInfo.primary = p;
    linkInfo.secondary = s;
    if( tracelinkDirection === 'Defining' ) {
        newTracelinkInfo.definingLinksInfo = [ linkInfo ];
        newTracelinkInfo.complyingLinksInfo = [];
    } else {
        newTracelinkInfo.complyingLinksInfo = [ linkInfo ];
        newTracelinkInfo.definingLinksInfo = [];
    }
    newTracelinkInfo.numOfLinksOnChildren = 1;
    return newTracelinkInfo;
};

/**
 * tracelinkCreated
 * @param {object} data view model
 *  @param {object} ctx context
 */
export let tracelinkCreated = function( data, ctx ) {
    var eventData = data.eventData;
    eventBus.publish( 'Arm0Traceability.unRegisterMatrixCellSelectedCtx' );
    if( !eventData.startItems || !eventData.endItems || !eventData.relationObjects ) {
        return;
    }

    if( eventData.startItems.length <= 0 || eventData.endItems.length <= 0 || eventData.relationObjects.length <= 0 ) {
        return;
    }

    var arrPrimaryObjs = eventData.startItems;
    var arrSecObjs = eventData.endItems;
    var arrRelationObjs = eventData.relationObjects;

    var indexRelationObj = 0;

    var arrModelObjs = [];

    // loading properties for both element and revision objects
    //(LCS-315470 - ATDD-The matrix cell having row number "2" and column number "1" should contain "1")
    for( var i = 0; i < eventData.startItems.length; i++ ) {
        arrModelObjs.push( cdm.getObject( eventData.startItems[ i ].uid ) );
        arrModelObjs.push( reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( eventData.startItems[ i ].uid ) ) );
    }
    for( i = 0; i < eventData.endItems.length; i++ ) {
        arrModelObjs.push( cdm.getObject( eventData.endItems[ i ].uid ) );
        arrModelObjs.push( reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( eventData.endItems[ i ].uid ) ) );
    }

    if( eventData.serviceData && eventData.serviceData.partialErrors && eventData.serviceData.partialErrors.length > 0 && eventData.relationObjects && eventData.relationObjects.length > 0 ) {
        // In case of partial failure, load Link objects to know primary & seconday objects
        soaSvc.postUnchecked( 'Core-2006-03-DataManagement', 'getProperties', {
            objects: eventData.relationObjects,
            attributes: [ 'primary_object', 'secondary_object' ]
        } ).then( function() {
            for( let index = 0; index < eventData.relationObjects.length; index++ ) {
                const relationObject = eventData.relationObjects[ index ];
                var primary_object = cdm.getObject( relationObject.props.primary_object.dbValues[ 0 ] );
                var secondary_object = cdm.getObject( relationObject.props.secondary_object.dbValues[ 0 ] );
                _cacheNewTracelinkCreated( data, primary_object, secondary_object, relationObject );
            }
            _postCreateTracelink( data, appCtxService.ctx );
        } );
    } else {
        var cellProp = [ 'object_string', 'object_name' ];
        if( eventData.serviceData.partialErrors && eventData.serviceData.partialErrors.length > 0 ) {
            //Refresh matrix if there are partial trace links created and partial failed
            refreshTraceabilityMatrix();
        } else {
            requirementsUtils.loadModelObjects( arrModelObjs, cellProp ).then( function() {
                for( var i = 0; i < arrPrimaryObjs.length; i++ ) {
                    var primObj = cdm.getObject( arrPrimaryObjs[ i ].uid );
                    for( var j = 0; j < arrSecObjs.length; j++ ) {
                        var relationObj = arrRelationObjs[ indexRelationObj ];
                        if( relationObj ) {
                            var secObj = cdm.getObject( arrSecObjs[ j ].uid );
                            _cacheNewTracelinkCreated( data, primObj, secObj, relationObj );
                            indexRelationObj += 1;
                        }
                    }
                }
                _postCreateTracelink( data, appCtxService.ctx );
            } );
        }
    }
};

var _postCreateTracelink = function( data, ctx ) {
    // Merge in new links in tree mode, replace old links with new links in list mode
    if( appCtxService.ctx.MatrixContext && appCtxService.ctx.tlmTreeMode ) {
        cellDataMap = _.merge( getCellMap( data, data.tracelinkInfo ), cellDataMap );
    } else {
        cellDataMap = getCellMap( data, data.tracelinkInfo );
    }
    processData( data, appCtxService.ctx );
    if( data.dataProviders && data.dataProviders.traceMatrixCellPropDataProvider && data.dataProviders.traceMatrixCellPropDataProvider.getViewModelCollection().loadedVMObjects.length > 0 ) {
        var selectionEventData = data.eventMap[ 'Arm0Traceability.showTracelinksPopup' ];
        if( selectionEventData ) {
            data.totalFound = 0;
            eventBus.publish( 'Arm0Traceability.showTracelinksPopup', selectionEventData );
            eventBus.publish( 'Arm0Traceability.refreshTableData' );
        }
    }
};

/**
 * Update Object name if updated from Info panel
 * @param {Array} updatedMOs -
 * @param {Object} data -
 * @param {Object} ctx -
 */
export let updatePropertiesOnModelObjectChanged = function( updatedMOs, data, ctx ) {
    if( !data.rowObjects || !data.colObjects ) {
        return; // rows/cols can be undefined in case of Replace action
    }
    var uids = updatedMOs.map( s => s.uid );
    var updatedObjects = [];
    var settingProps = Object.keys( settingProperties );
    settingProps = settingProps && settingProps.length > 0 ? settingProps : [ 'object_name' ];
    // Get updated from row
    var updatedRowObjs = Array.from( data.rowObjects ).filter( function( obj ) { return obj.persistentObject && obj.persistentObject.uid && uids.includes( obj.persistentObject.uid ); } );
    updatedRowObjs.forEach( function( obj ) {
        var mo = cdm.getObject( obj.persistentObject.uid );
        settingProps.forEach( propName => {
            if( mo && mo.props && mo.props[ propName ] ) {
                var updatedProp = _updateSettingPropertyValue( obj, propName, mo.props[ propName ].uiValues[ 0 ] );
                if( updatedProp ) {
                    updatedObjects.push( obj );
                }
            }
        } );
    } );

    // Get updated from Columns
    var updatedColObjs = Array.from( data.colObjects ).filter( function( obj ) { return obj.persistentObject && obj.persistentObject.uid && uids.includes( obj.persistentObject.uid ); } );
    updatedColObjs.forEach( function( obj ) {
        var mo = cdm.getObject( obj.persistentObject.uid );
        settingProps.forEach( propName => {
            if( mo && mo.props && mo.props[ propName ] ) {
                var updatedProp = _updateSettingPropertyValue( obj, propName, mo.props[ propName ].uiValues[ 0 ] );
                if( updatedProp ) {
                    updatedObjects.push( obj );
                }
            }
        } );
    } );

    // Check for src & target objects
    if( data.srcObjectInfo && data.srcObjectInfo.persistentObject && uids.includes( data.srcObjectInfo.persistentObject.uid ) ) {
        var mo = cdm.getObject( data.srcObjectInfo.persistentObject.uid );
        if( mo && mo.props && mo.props.object_name && data.srcObjectInfo.displayName && data.srcObjectInfo.displayName !== mo.props.object_name.dbValues[ 0 ] ) {
            data.srcObjectInfo.displayName = mo.props.object_name.dbValues[ 0 ];
            updatedObjects.push( data.srcObjectInfo );
        }
    }
    if( data.targetObjectInfo && data.targetObjectInfo.persistentObject && uids.includes( data.targetObjectInfo.persistentObject.uid ) ) {
        var mo = cdm.getObject( data.targetObjectInfo.persistentObject.uid );
        if( mo && mo.props && mo.props.object_name && data.targetObjectInfo.displayName && data.targetObjectInfo.displayName !== mo.props.object_name.dbValues[ 0 ] ) {
            data.targetObjectInfo.displayName = mo.props.object_name.dbValues[ 0 ];
            updatedObjects.push( data.targetObjectInfo );
        }
    }

    if( updatedObjects.length > 0 ) {
        processData( data, ctx );
    }
};

/**
 * _resetProductContext
 *
 * @param {Object}
 *            ctx ctx
 */
var _resetProductContext = function( ctx ) {
    _checkMatrixContext( appCtxService.ctx );
    var MatrixContext = null;
    if( appCtxService.ctx.occmgmtContext ) {
        MatrixContext = appCtxService.getCtx( 'MatrixContext' );
        if( MatrixContext ) {
            MatrixContext.sourcePCI = {
                uid: appCtxService.ctx.occmgmtContext.productContextInfo.uid
            };
            MatrixContext.targetPCI = {
                uid: appCtxService.ctx.occmgmtContext.productContextInfo.uid
            };
            appCtxService.updateCtx( 'MatrixContext', MatrixContext );
        } else {
            MatrixContext.sourcePCI = {
                uid: appCtxService.ctx.occmgmtContext.productContextInfo.uid
            };
            MatrixContext.targetPCI = {
                uid: appCtxService.ctx.occmgmtContext.productContextInfo.uid
            };
            appCtxService.registerCtx( 'MatrixContext', MatrixContext );
        }
    } else {
        MatrixContext = appCtxService.getCtx( 'MatrixContext' );
        if( MatrixContext ) {
            MatrixContext.sourcePCI = {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            };
            MatrixContext.targetPCI = {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            };
            appCtxService.updateCtx( 'MatrixContext', MatrixContext );
        } else {
            MatrixContext.sourcePCI = {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            };
            MatrixContext.targetPCI = {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            };
            appCtxService.registerCtx( 'MatrixContext', MatrixContext );
        }
    }
};

/**
 * Reset tree variables
 *
 *
 */
var resetTreeStructure = function() {
    if( appCtxService.ctx.MatrixContext.peakSrcInfo ) {
        appCtxService.updateCtx( 'sourceObjects', [ appCtxService.ctx.MatrixContext.peakSrcInfo.occurrence ] );
        appCtxService.updateCtx( 'targetObjects', [ appCtxService.ctx.MatrixContext.peakTargetInfo.occurrence ] );
    }

    var MatrixContext = appCtxService.getCtx( 'MatrixContext' );
    if( MatrixContext ) {
        MatrixContext.parentRows = null;
        MatrixContext.expandedRows = [];
        MatrixContext.parentCols = null;
        MatrixContext.expandedCols = [];
        appCtxService.updateCtx( 'MatrixContext', MatrixContext );
    }
};

/**
 * Reset Matrix Context : This function will set all button and menu flags to default state amongst other things.
 *
 * @param {Object}
 *            ctx ctx
 */
var resetMatrixContext = function( ctx ) {
    var MatrixContext = appCtxService.getCtx( 'MatrixContext' );
    if( MatrixContext ) {
        MatrixContext.sourceObjects = null;
        MatrixContext.targetObjects = null;
        MatrixContext.pageInfo = {};
        MatrixContext.relationType = 'ALL';
        MatrixContext.showChildrenTracelinks = false;
        MatrixContext.isRunInBackground = false;
        MatrixContext.sourcePCI = {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        };
        MatrixContext.targetPCI = {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        };
        MatrixContext.isMatrixSaved = false;
        MatrixContext.sortRow = null;
        MatrixContext.sortCol = null;
        appCtxService.updateCtx( 'MatrixContext', MatrixContext );
    } else {
        MatrixContext = {
            sourceObjects: null,
            targetObjects: null,
            pageInfo: {},
            relationTypes: [ 'ALL' ],
            showChildTracelinks: false,
            isRunInBackground: false,
            sourcePCI: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            targetPCI: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            isMatrixSaved: false,
            sortRow: null,
            sortCol: null
        };
        appCtxService.registerCtx( 'MatrixContext', MatrixContext );
    }

    if( typeof appCtxService.ctx.tlmTreeMode === 'undefined' ) {
        appCtxService.registerCtx( 'tlmTreeMode', true );
    }

    if( typeof appCtxService.ctx.showTracelinkDirection === 'undefined' ) {
        appCtxService.registerCtx( 'showTracelinkDirection', false );
    }

    if( typeof appCtxService.ctx.showEmpty === 'undefined' ) {
        appCtxService.registerCtx( 'showEmpty', true );
    }

    if( typeof appCtxService.ctx.highlightshowHeatmap === 'undefined' ) {
        appCtxService.registerCtx( 'highlightshowHeatmap', false );
    }

    appCtxService.registerCtx( 'showObjectName', true );

    appCtxService.registerCtx( 'showObjectId', false );
    settingProperties = {};
    appCtxService.registerCtx( 'showObjectOwner', false );
    settingPropertiesToBeShown = [];
    cellDataMap = {};
    if( typeof appCtxService.ctx.showTracelinkCount === 'undefined' ) {
        appCtxService.registerCtx( 'showTracelinkCount', true );
    }

    if( typeof appCtxService.ctx.highlightshow25items === 'undefined' ) {
        appCtxService.registerCtx( 'highlightshow25items', true );
    }

    if( typeof appCtxService.ctx.highlightshow50items === 'undefined' ) {
        appCtxService.registerCtx( 'highlightshow50items', false );
    }

    if( typeof appCtxService.ctx.highlightshow100items === 'undefined' ) {
        appCtxService.registerCtx( 'highlightshow100items', false );
    }

    appCtxService.registerCtx( 'showTracelinkDirection', false );

    _resetLocalSortData();
    reqTraceabilityMatrixService.resetCachedCoordsOfMatrixContainer();
};

/**
 * _checkMatrixContext
 *
 * @param {Object}
 *            ctx ctx
 */
var _checkMatrixContext = function( ctx ) {
    if( !appCtxService.ctx.MatrixContext ) {
        resetMatrixContext( appCtxService.ctx );
    }
};

/**
 * _setMatrixSourceTargetObjects
 *
 * @param {Object}
 *            ctx ctx
 * @param {Object}
 *            sourceObj sourceObj
 * @param {Object}
 *            targetObj targetObj
 */
var _setMatrixSourceTargetObjects = function( ctx, sourceObj, targetObj ) {
    if( sourceObj ) {
        var sourceObjects = [];
        var tmpSource = {
            uid: sourceObj.uid
        };
        sourceObjects.push( tmpSource );
        appCtxService.registerCtx( 'sourceObjects', sourceObjects );
    }
    if( targetObj ) {
        var targetObjects = [];
        var tmpTarget = {
            uid: targetObj.uid
        };
        targetObjects.push( tmpTarget );
        appCtxService.registerCtx( 'targetObjects', targetObjects );
    }
};

/**
 * _loadAndSetSourceTargetObjects
 *
 * @param {Object}
 *            ctx ctx
 * @param {Object}
 *            sourceObj sourceObj
 * @param {Object}
 *            targetObj targetObj
 */
var _loadAndSetSourceTargetObjects = function( ctx, sourceObj, targetObj ) {
    var arrModelObjs = [];
    var deferred = AwPromiseService.instance.defer();
    var cellProp = [ 'awp0CellProperties', 'awb0UnderlyingObject' ];
    if( sourceObj ) {
        arrModelObjs.push( sourceObj );
    }

    if( targetObj ) {
        arrModelObjs.push( targetObj );
    }
    requirementsUtils.loadModelObjects( arrModelObjs, cellProp ).then( function() {
        _setMatrixSourceTargetObjects( appCtxService.ctx, cdm.getObject( sourceObj.uid ), cdm.getObject( targetObj.uid ) );
        deferred.resolve();
    } );

    return deferred.promise;
};

/**
 * _setSourceTargetProductContext
 *
 * @param {Object}
 *            ctx ctx
 * @param {Object}
 *            sourcePCI sourcePCI
 * @param {Object}
 *            targetPCI targetPCI
 */
var _setSourceTargetProductContext = function( ctx, sourcePCI, targetPCI ) {
    _checkMatrixContext( appCtxService.ctx );
    var MatrixContext = appCtxService.getCtx( 'MatrixContext' );
    if( sourcePCI ) {
        MatrixContext.sourcePCI = {
            uid: sourcePCI.uid
        };
        appCtxService.updateCtx( 'MatrixContext', MatrixContext );
    }
    if( targetPCI ) {
        MatrixContext.targetPCI = {
            uid: targetPCI.uid
        };
        appCtxService.updateCtx( 'MatrixContext', MatrixContext );
    }
};

/**
         * Capture the user selections for later use.

         *  @param {Object} ctx - The context
         *
         */
export let captureUserSelection = function( ctx ) {
    matrixType = appCtxService.ctx.matrixType;
    sourceObjects2 = appCtxService.ctx.sourceObjects;
    targetObjects2 = appCtxService.ctx.targetObjects;

    if( !appCtxService.ctx.xrtPageContext || appCtxService.ctx.xrtPageContext.secondaryXrtPageID !== 'arm0TraceabilityMatrix' ) {
        appCtxService.registerCtx( 'generateTracebilityMatrixOnReveal', true );
        resetMatrixContext( appCtxService.ctx );
        _resetProductContext( appCtxService.ctx );
    } else {
        eventBus.publish( 'requirementDocumentation.loadMatrixData' );
    }
};

/**
 * prepare the payload for replace matrix operation
 * @param {Boolean} replaceType of radio button if true then replace src else target
 * @param {object} object selected by user in replace panel
 * @param {Object} ctx
 *
 */
export let generateTraceabilityMatrix = function( replaceType, selectedObject, ctx ) {
    if( selectedObject ) {
        var srcInfo = {};
        var targetInfo = {};
        var cellProp = [ 'awp0CellProperties', 'awb0UnderlyingObject' ];
        var arrModelObjs = [];

        if( appCtxService.ctx.MatrixContext ) {
            if( appCtxService.ctx.MatrixContext.peakTargetInfo ) {
                targetInfo = appCtxService.ctx.MatrixContext.peakTargetInfo.occurrence;
                if( targetInfo ) {
                    arrModelObjs.push( {
                        uid: targetInfo.uid
                    } );
                }
            }
            if( appCtxService.ctx.MatrixContext.peakSrcInfo ) {
                srcInfo = appCtxService.ctx.MatrixContext.peakSrcInfo.occurrence;
                if( srcInfo ) {
                    arrModelObjs.push( {
                        uid: srcInfo.uid
                    } );
                }
            }
        }

        requirementsUtils.loadModelObjects( arrModelObjs, cellProp ).then( function() {
            if( replaceType ) {
                var revObject = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( arrModelObjs[ 1 ].uid ) );

                var srcObj = {
                    uid: selectedObject
                };

                if( revObject.uid === selectedObject ) {
                    srcObj.uid = arrModelObjs[ 1 ].uid;
                }
                var sourcePCI = {
                    uid: 'AAAAAAAAAAAAAA',
                    type: 'unknownType'
                };
                _setMatrixSourceTargetObjects( appCtxService.ctx, srcObj, arrModelObjs[ 0 ] );
                _setSourceTargetProductContext( appCtxService.ctx, sourcePCI );
            } else {
                revObject = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( arrModelObjs[ 0 ].uid ) );

                var targetObj = {
                    uid: selectedObject
                };

                if( revObject.uid === selectedObject ) {
                    targetObj.uid = arrModelObjs[ 0 ].uid;
                }
                var targetPCI = {
                    uid: 'AAAAAAAAAAAAAA',
                    type: 'unknownType'
                };
                _setMatrixSourceTargetObjects( appCtxService.ctx, arrModelObjs[ 1 ], targetObj );
                _setSourceTargetProductContext( appCtxService.ctx, null, targetPCI );
            }

            _data.replacePayload = {
                info: 'req_replace_matrix_payload2',
                srcObjectInfo: { occurrence: appCtxService.ctx.sourceObjects[ 0 ] },

                targetObjectInfo: { occurrence: appCtxService.ctx.targetObjects[ 0 ] },
                srcContextInfo: appCtxService.ctx.MatrixContext.sourcePCI,
                targetContextInfo: appCtxService.ctx.MatrixContext.targetPCI,
                matrixType: _data.matrixType
            };

            getTraceabilityMatrix2( _data, appCtxService.ctx, _data.replacePayload );
        } );
    }
};

/**
 * Loading saved matrix using a fms ticket. This also used to load Rollup Matrix.
 *
 * @param {Object}
 *            data data
 * @param {Object}
 *            ctx ctx
 * @param {Object}
 *            fmsTicket fmsTicket
 */
var loadTraceabilityMatrix = function( data, ctx, fmsTicket ) {
    if( fmsTicket ) {
        $.get( exports.getFileUrl( fmsTicket ), function( data1 ) {
            var jsonObject = JSON.parse( data1 );
            if( !jsonObject.isSaved && jsonObject.matrixType !== 'Full-Rollup Matrix' ) {
                // generate matrix if not saved, instead of loading from json
                getTraceabilityMatrix2( data, appCtxService.ctx, jsonObject );
                return;
            }
            data.tracelinkInfo = jsonObject.matrixCellInfo;
            data.rowObjects = jsonObject.rowObjects;
            data.colObjects = jsonObject.colObjects;
            data.srcObjectInfo = jsonObject.srcObjectInfo;
            data.targetObjectInfo = jsonObject.targetObjectInfo;
            data.targetContextInfo = jsonObject.targetContextInfo;
            data.srcContextInfo = jsonObject.srcContextInfo;
            data.targetParentObjectInfo = jsonObject.targetParentObjectInfo;
            data.srcParentObjectInfo = jsonObject.srcParentObjectInfo;
            data.matrixType = jsonObject.matrixType;
            data.isSaved = jsonObject.isSaved;
            data.ServiceData = jsonObject.ServiceData;

            if( jsonObject.matrixSettings && jsonObject.matrixSettings.length > 0 ) {
                settingPropertiesToBeShown = jsonObject.matrixSettings;
            }
            appCtxService.registerCtx( 'showTracelinkDirection', jsonObject.showArrows );

            if( data.targetObjectInfo && data.srcObjectInfo ) {
                var uidsToLoad = [];
                if( data.srcObjectInfo.occurrence ) {
                    uidsToLoad.push( data.srcObjectInfo.occurrence.uid );
                }
                if( data.targetObjectInfo.occurrence ) {
                    uidsToLoad.push( data.targetObjectInfo.occurrence.uid );
                }
                if( uidsToLoad.length > 0 ) {
                    dmSvc.loadObjects( uidsToLoad );
                }
            }

            var MatrixContext = {
                isMatrixSaved: data.isSaved
            };
            appCtxService.registerCtx( 'MatrixContext', MatrixContext );
            if( appCtxService.ctx.tlmTreeMode ) {
                resetTreeStructure();
            }

            if( data.matrixType === 'Full-Rollup Matrix' ) {
                data.showFullRollupCase = true;
                data.isFullRollUp = true;
                data.matrixTypeDisplayName = localTextBundle.FullRollup;
            } else if( data.matrixType === 'Dynamic Matrix' ) {
                data.matrixTypeDisplayName = localTextBundle.Dynamic;
            } else {
                data.matrixTypeDisplayName = localTextBundle.QuickMatrix;
            }
            data.dispatch( { path: 'data.matrixTypeDisplayName', value: data.matrixTypeDisplayName } );
            //
            // Quick/Full-Rollup Matrix we one peak src and target as general rule.
            //
            if( !appCtxService.ctx.sourceObjects && data.matrixType !== 'Dynamic Matrix' ) {
                appCtxService.registerCtx( 'sourceObjects', [ { uid: data.srcObjectInfo.occurrence.uid } ] );
                appCtxService.registerCtx( 'targetObjects', [ { uid: data.targetObjectInfo.occurrence.uid } ] );
            }
            exports.processDataFromServer( data, appCtxService.ctx );
            data.dispatch( { path: 'data', value: data } );
            calculateFilterOptions( data, jsonObject );
            // Required for sorting logic
            var needAllData = appCtxService.ctx.tlmTreeMode || showEmptyRowsandColsActionState || appCtxService.ctx.MatrixContext.sortRow || appCtxService.ctx.MatrixContext.sortCol;
            haveFullData = needAllData;
        } );
    }
};

/**
 * Prepares the payload to call SOA with Quick Matrix.
 *
 * @param {Object}  matrix_startup_props
 * @param {Object}  ctx
 *
 * @return {Array} input data
 */
var getTraceMatrixInputQuick = function( data, matrix_startup_props, ctx ) {
    var isAsyncCall = false;
    var showChildrenCount = false;
    var itemsPerPage = -1;
    var srcPCI = {};
    var targetPCI = {};
    var matrix = {};
    var sources = [];
    var targets = [];

    sources.push( matrix_startup_props.srcObjectInfo.occurrence );
    targets.push( matrix_startup_props.targetObjectInfo.occurrence );

    if( matrix_startup_props.srcContextInfo ) {
        srcPCI = matrix_startup_props.srcContextInfo;
    }

    if( matrix_startup_props.targetContextInfo ) {
        targetPCI = matrix_startup_props.targetContextInfo;
    }

    if( appCtxService.ctx.tlmTreeMode ) {
        resetTreeStructure();
    }
    var option = [ 'PopulateRecipeCount' ];
    if( data.isReviseOps ) {
        option.push( 'startFreshNavigation' );
    }

    return {
        actionPerformed: 'TRAVERSE_CHILD',
        colPageToNavigate: 1,
        isRunInBackground: false,
        itemsPerPage: -1,
        options: option,
        relationTypes: [ 'ALL' ],
        rowPageToNavigate: 1,
        showChildTracelinks: false,
        srcContextInfo: srcPCI,
        sourceObjects: sources,
        targetContextInfo: targetPCI,
        targetObjects: targets,
        traceMatrixObject: matrix
    };
};

/**
 * Pulish event to call soa for filter data
 *
 */
export let applyFilterToTM = function() {
    eventBus.publish( 'Arm0FilterTM.loadMatrixFilterData' );
};

/**
 * Prepares the payload to call SOA with Quick Matrix.
 * @param {Object} data - the page view model object
 * @param {Object}  ctx - ctx instance Object
 *
 * @return {Array} input data
 */
export let getTraceMatrixFilterInput = function( data, ctx ) {
    var isAsyncCall = false;
    var showChildrenCount = false;
    var itemsPerPage = -1;
    var srcPCI = {};
    var targetPCI = {};
    var sources = [];
    var targets = [];
    var rowFilter = {};
    var colFilter = {};
    var matrixContext = appCtxService.ctx.MatrixContext;

    if( appCtxService.ctx.matrixType === 'Dynamic Matrix' ) {
        for( var i = 0; i < data.rowObjects.length; i++ ) {
            if( data.rowObjects[ i ].occurrence ) {
                sources.push( { uid: data.rowObjects[ i ].occurrence.uid } );
            }
        }
        itemsPerPage = parseInt( data.noOfItem.dbValue );
    }
    if( appCtxService.ctx.matrixType === 'Quick Matrix' ) {
        sources = [ matrixContext.peakSrcInfo.occurrence ];
        targets = [ matrixContext.peakTargetInfo.occurrence ];

        if( matrixContext.sourcePCI ) {
            srcPCI = matrixContext.sourcePCI;
        }
        if( matrixContext.targetPCI ) {
            targetPCI = matrixContext.targetPCI;
        }
        if( appCtxService.ctx.tlmTreeMode ) {
            cellDataMap = {};
            resetTreeStructure( appCtxService.ctx );
            // tltotypeMap = new Map();
            // tlTypeList = [];
            // tlTypeListIn = [ localTextBundle.all ];
        }
        if( matrixContext.rowFilter ) {
            rowFilter = matrixContext.rowFilter.filter;
        }
        if( matrixContext.colFilter ) {
            colFilter = matrixContext.colFilter.filter;
        }
        if( matrixContext.peakTargetInfo.occurrence.uid && matrixContext.peakTargetInfo.occurrence.uid === matrixContext.peakSrcInfo.occurrence.uid ) {
            colFilter = rowFilter;
        }
    }
    var options = []; // filter in option required to return filterOutput for the given structure
    var activeFilterView = appCtxService.ctx.MatrixContext.activeFilterView;
    if( activeFilterView === 'ROW' || activeFilterView === 'ROW_COLUMN' ) {
        options.push( 'PopulateSourceFilter' );
    } else if( activeFilterView === 'COLUMN' ) {
        options.push( 'PopulateTargetFilter' );
    }
    return {
        actionPerformed: 'TRAVERSE_CHILD',
        colPageToNavigate: 1,
        isRunInBackground: isAsyncCall,
        itemsPerPage: itemsPerPage,
        options: options,
        rowPageToNavigate: 1,
        showChildTracelinks: showChildrenCount,
        srcContextInfo: srcPCI,
        sourceObjects: sources,
        targetContextInfo: targetPCI,
        targetObjects: targets,
        traceMatrixObject: matrixContext.matrixObj,
        relationTypes: matrixContext.typeFilter && matrixContext.typeFilter.filter ? matrixContext.typeFilter.filter : [ 'ALL' ],
        sortCriteria: {
            propertyName: '',
            sortingOrder: ''
        },
        srcFilterInput: rowFilter,
        targetFilterInput: colFilter
    };
};

/**
 * resizeWindow
 */
export let resizeWindow = function() {
    reqTraceabilityMatrixService.resizeMatrix();
};

/**
 * Prepares the payload to call SOA for dynamic matrix
 *
 * @param {Object}  matrix_startup_props
 * @param {Object}  ctx
 *
 * @return {Array} input data
 */
var getTraceMatrixInputDynamic = function( matrix_startup_props, ctx ) {
    var isAsyncCall = false;
    var showChildrenCount = false;
    var itemsPerPage = -1;
    var srcPCI = {};
    var targetPCI = {};
    var matrix = {
        uid: 'AAAAAAAAAAAAAA',
        type: 'unknownType'
    };
    var sources = [];
    var targets = [];

    // get source from rows
    matrix_startup_props.rowObjects.forEach( row => {
        sources.push( row.occurrence );
    } );

    if( matrix_startup_props.srcContextInfo ) {
        srcPCI = matrix_startup_props.srcContextInfo;
    }

    if( matrix_startup_props.targetContextInfo ) {
        targetPCI = matrix_startup_props.targetContextInfo;
    }

    return {
        actionPerformed: 'TRAVERSE_CHILD',
        colPageToNavigate: 1,
        isRunInBackground: false,
        itemsPerPage: -1,
        options: [],
        relationTypes: [ 'ALL' ],
        rowPageToNavigate: 1,
        showChildTracelinks: false,
        srcContextInfo: srcPCI,
        sourceObjects: sources,
        targetContextInfo: targetPCI,
        targetObjects: targets,
        traceMatrixObject: matrix
    };
};

/**
 * Uses the req_generate_matrix_payload2 session data to call SOA.
 *
 * @param {object} data Input data
 * @param {Object} ctx - The context
 */
var getTraceabilityMatrix2 = function( data, ctx, payLoad ) {
    if( payLoad ) {
        data.matrixType = payLoad.matrixType;
        data.matrixTypeDisplayName = data.i18n.QuickMatrix;
        data.matrixTypeDisplayName = payLoad.matrixType === 'Dynamic Matrix' ? data.i18n.Dynamic : data.matrixTypeDisplayName;

        data.dispatch( { path: 'data.matrixTypeDisplayName', value: data.matrixTypeDisplayName } );

        if( data.matrixType === 'Dynamic Matrix' ) {
            var soaInput = {
                inputData: getTraceMatrixInputDynamic( payLoad, appCtxService.ctx )
            };
            if( _data.replacePayload && _data.replacePayload.info === 'req_replace_matrix_payload2' ) {
                soaInput.inputData.options = [ 'GENERATE_MATRIX' ];
            }
            //ensure the owning user property loaded
            var policyId = propPolicySvc.register( {
                types: [ {
                    name: 'ItemRevision',
                    properties: [ {
                        name: 'owning_user',
                        modifiers: [ {
                            name: 'withProperties',
                            Value: 'true'
                        } ]
                    } ]
                } ]
            } );

            //ensure the owning user property loaded
            var policyId = propPolicySvc.register( {
                types: [ {
                    name: 'ItemRevision',
                    properties: [ {
                        name: 'item_id',
                        modifiers: [ {
                            name: 'withProperties',
                            Value: 'true'
                        } ]
                    } ]
                },
                {
                    name: 'WorkspaceObject',
                    properties: [ {
                        name: 'owning_user',
                        modifiers: [ {
                            name: 'withProperties',
                            Value: 'true'
                        } ]
                    } ]
                },
                {
                    name: 'Awb0Element',
                    properties: [ {
                        name: 'awb0Parent',
                        modifiers: [ {
                            name: 'withProperties',
                            Value: 'true'
                        } ]
                    } ]
                }
                ]
            } );

            soaSvc.postUnchecked( 'Internal-AwReqMgmtSe-2021-06-SpecNavigation', 'getTraceabilityMatrix2', soaInput )
                .then(
                    function( payDump ) {
                        //UnRegister Policy
                        if( policyId ) {
                            propPolicySvc.unregister( policyId );
                        }
                        data.tracelinkInfo = payDump.matrixCellInfo;
                        data.rowObjects = payDump.rowObjects;
                        data.colObjects = payDump.colObjects;
                        data.srcObjectInfo = payDump.srcObjectInfo;
                        data.targetObjectInfo = payDump.targetObjectInfo;
                        data.targetContextInfo = payDump.targetContextInfo;
                        data.srcContextInfo = payDump.srcContextInfo;
                        data.targetParentObjectInfo = payDump.targetParentObjectInfo;
                        data.srcParentObjectInfo = payDump.srcParentObjectInfo;
                        data.isSaved = payDump.isSaved;
                        data.ServiceData = payDump.ServiceData;
                        data.traceabilityMatrixObject = payDump.traceabilityMatrixObject;
                        data.filterOutput = payDump.filterOutput;

                        var MatrixContext = {
                            isMatrixSaved: data.isSaved
                        };
                        appCtxService.registerCtx( 'MatrixContext', MatrixContext );
                        if( appCtxService.ctx.tlmTreeMode ) {
                            resetTreeStructure();
                        }

                        if( data.matrixType === 'Full-Rollup Matrix' ) {
                            data.showFullRollupCase = true;
                            data.isFullRollUp = true;
                        }

                        if( !appCtxService.ctx.sourceObjects && data.matrixType !== 'Dynamic Matrix' ) {
                            let sourceObjects = [ { uid: data.srcObjectInfo.occurrence.uid } ];
                            let targetObjects = [ { uid: data.targetObjectInfo.occurrence.uid } ];
                            appCtxService.registerCtx( 'sourceObjects', sourceObjects );
                            appCtxService.registerCtx( 'sourceObjects', targetObjects );
                        }

                        processDataFromServer( data, appCtxService.ctx );
                        data.dispatch( { path: 'data', value: data } );
                        // Required for sorting logic
                        var needAllData = appCtxService.ctx.tlmTreeMode || showEmptyRowsandColsActionState || appCtxService.ctx.MatrixContext.sortRow || appCtxService.ctx.MatrixContext.sortCol;
                        haveFullData = needAllData;
                        // data.dispatch( { path: 'data', value: data } );
                        calculateFilterOptions( data, payDump );
                    } );
        } else {
            var soaInput = {
                inputData: getTraceMatrixInputQuick( data, payLoad, appCtxService.ctx )
            };

            if( _data.replacePayload && _data.replacePayload.info === 'req_replace_matrix_payload2' ) {
                soaInput.inputData.options = [ 'GENERATE_MATRIX' ];
            }

            soaSvc.postUnchecked( 'Internal-AwReqMgmtSe-2021-06-SpecNavigation', 'getTraceabilityMatrix2', soaInput )
                .then(
                    function( payDump ) {
                        data.tracelinkInfo = payDump.matrixCellInfo;
                        data.rowObjects = payDump.rowObjects;
                        data.colObjects = payDump.colObjects;
                        data.srcObjectInfo = payDump.srcObjectInfo;
                        data.targetObjectInfo = payDump.targetObjectInfo;
                        data.targetContextInfo = payDump.targetContextInfo;
                        data.srcContextInfo = payDump.srcContextInfo;
                        data.targetParentObjectInfo = payDump.targetParentObjectInfo;
                        data.srcParentObjectInfo = payDump.srcParentObjectInfo;
                        data.isSaved = payDump.isSaved;
                        data.ServiceData = payDump.ServiceData;
                        data.traceabilityMatrixObject = payDump.traceabilityMatrixObject;
                        data.filterOutput = payDump.filterOutput;

                        cellDataMap = {};
                        tltotypeMap = new Map();
                        tlTypeList = [];
                        tlTypeListIn = [ localTextBundle.all ];
                        if( _data && _data.replacePayload && _data.replacePayload.info === 'req_replace_matrix_payload2' ) {
                            data.dispatch( { path: 'data', value: data } );
                            let navigationParams = {
                                uid: data.traceabilityMatrixObject.uid
                            };
                            let action = {
                                actionType: 'Navigate',
                                navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
                            };
                            navigationSvc.navigate( action, navigationParams );
                        } else {
                            var MatrixContext = {
                                isMatrixSaved: data.isSaved
                            };
                            appCtxService.registerCtx( 'MatrixContext', MatrixContext );

                            if( appCtxService.ctx.tlmTreeMode ) {
                                resetTreeStructure();
                            }

                            if( data.matrixType === 'Full-Rollup Matrix' ) {
                                data.showFullRollupCase = true;
                                data.isFullRollUp = true;
                            }

                            if( !appCtxService.ctx.sourceObjects && data.matrixType !== 'Dynamic Matrix' ) {
                                let sourceObjects = [ { uid: data.srcObjectInfo.occurrence.uid } ];
                                let targetObjects = [ { uid: data.targetObjectInfo.occurrence.uid } ];
                                appCtxService.registerCtx( 'sourceObjects', sourceObjects );
                                appCtxService.registerCtx( 'sourceObjects', targetObjects );
                            }

                            processDataFromServer( data, appCtxService.ctx );
                            data.dispatch( { path: 'data', value: data } );
                            // Required for sorting logic
                            var needAllData = appCtxService.ctx.tlmTreeMode || showEmptyRowsandColsActionState || appCtxService.ctx.MatrixContext.sortRow || appCtxService.ctx.MatrixContext.sortCol;
                            haveFullData = needAllData;
                            calculateFilterOptions( data, payDump );
                        }
                    } );
        }
    }
};

eventBus.subscribe( 'Arm0Traceability.applyMatrixSettings', function( event ) {
    processData( null, event );
} );

eventBus.subscribe( 'Arm0Traceability.refreshTableData', function() {
    AwTimeoutService.instance( function() {
        resizeWindow();
    }, 100 );
} );

/**
 * Initialize matrix controls
 *
 * @param {object} data Input data
 * @param {Object} ctx - The context
 */
export let init = function( data, ctx ) {
    resetMatrixContext( appCtxService.ctx );
    resetTreeStructure();

    if( data === null ) {
        data = _data;
    }

    requirementsUtils.getTraceabilityMatrixFMSTicket( appCtxService.ctx.selected ).then( function( fmsTicket ) {
        loadTraceabilityMatrix( data, appCtxService.ctx, fmsTicket );
    } );

    if( data.noOfPageListIn ) {
        data.noOfPageList = listBoxService.createListModelObjectsFromStrings( data.noOfPageListIn.dbValue );
    }
    _data = data;
};

export let resetMatrixCommandClick = function( ctx ) {
    appCtxService.registerCtx( 'MatrixReset', true );
    var matrixObj = appCtxService.ctx.MatrixContext.matrixObj;
    resetMatrixContext( appCtxService.ctx );
    resetTreeStructure( appCtxService.ctx );
    requirementsUtils.getTraceabilityMatrixFMSTicket( matrixObj ).then( function( fmsTicket ) {
        loadTraceabilityMatrix( _data, appCtxService.ctx, fmsTicket );
    } );
};

/**
 * Return an empty ListModel object.
 * @param {Object} objs - Empty ListModel object.
 * @return {Object} matrixTypes- Empty ListModel object.
 */
var _getMatrixTypeVMO = function( objs ) {
    var matrixTypes = [];
    for( var i = 0; i < objs.length; i++ ) {
        var output = objs[ i ];
        if( output ) {
            var listModel = _getEmptyListModel();
            listModel.propDisplayValue = output.propDisplayValue;
            listModel.propInternalValue = output.propInternalValue;
            matrixTypes.push( listModel );
        }
    }
    return matrixTypes;
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * Return an empty ListModel object.
 * @param {Object} objs - Empty ListModel object.
 * @return {Object} matrixTypes- Empty ListModel object.
 */
var _getMatrixTypeVMO = function( objs ) {
    var matrixTypes = [];
    for( var i = 0; i < objs.length; i++ ) {
        var output = objs[ i ];
        if( output ) {
            var listModel = _getEmptyListModel();
            listModel.propDisplayValue = output.propDisplayValue;
            listModel.propInternalValue = output.propInternalValue;
            matrixTypes.push( listModel );
        }
    }
    return matrixTypes;
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * getFileUrl
 *
 * @param {Object}
 *            ticket fms ticket id
 *
 * @return {String} fms file url
 */
export let getFileUrl = function( ticket ) {
    return 'fms/fmsdownload/?ticket=' + ticket;
};

/**
 * event habdler to open replace panel
 */
export let openReplacePanel = function() {
    commandPanelService.activateCommandPanel( 'Arm0ReplacePanel', 'aw_toolsAndInfo', null );
};

/**
 * the traceability matrix will be set to its original state
 * @param {object} data Input data
 */
export let resetTraceMatrix = function( data ) {
    _data.colObjects = _.cloneDeep( _data.clonedColObjects );
    _data.rowObjects = _.cloneDeep( _data.clonedRowObjects );
    resetMatrixContext( appCtxService.ctx );
    init( null, appCtxService.ctx );
};

/**
 * rollupClicked
 * @param {Object}
 *            ctx The context
 * @param {Object}
 *            data event data
 */
export let rollupClicked = function( ctx, data ) {
    data.isFullRollUp = true;
    data.showChildTracelinks = true;
    eventBus.publish( 'requirementTraceabilityMatrix.getChildRollup' );
};

/**
 * Create input for getInterfaces SOA
 *
 * @param {Object}
 *            ctx The context
 * @param {Object}
 *            data event data
 *
 * @return {Array} input data for get interfaces
 */
export let getChildMatrixInput = function( ctx, data ) {
    var matrixObj = 'AAAAAAAAAAAAAA';
    var isRunInBackground = data.isFullRollUp || false;
    if( data.showFullRollupCase ) {
        data.showChildTracelinks = false;
        matrixObj = appCtxService.ctx.selected.uid;
        isRunInBackground = false;
    }
    var eventData = data.eventMap ? data.eventMap[ 'requirementDocumentation.navigate' ] : undefined;
    var actionPerformed = eventData && eventData.expandOption ? eventData.expandOption : 'TRAVERSE_CHILD';
    var srcPCI = appCtxService.ctx.MatrixContext.sourcePCI;
    var targetPCI = appCtxService.ctx.MatrixContext.targetPCI;

    if( data.eventMap && data.eventMap[ 'requirementDocumentation.navigate' ] ) {
        // Clear once it is used
        delete data.eventMap[ 'requirementDocumentation.navigate' ];
    }

    // different from source
    var itemsPerPage = parseInt( data.noOfItem.dbValue );

    var sourceObjects = [];
    var targetObjects = [];
    var MatrixContext = appCtxService.getCtx( 'MatrixContext' );

    // determine source and target structures
    if( data.eventData && data.eventData.rowUid ) {
        var source = {
            uid: data.eventData.rowUid
        };
        sourceObjects.push( source );
        if( data.eventData.rowUid === '-1' ) {
            sourceObjects = appCtxService.ctx.sourceObjects;
        }
        // in tree mode need to pass all expand rows
        if( appCtxService.ctx.tlmTreeMode ) {
            MatrixContext.parentRows = data.rowObjects;
            MatrixContext.parentCols = data.colObjects;
            parentRowUid = data.eventData.rowUid;
            if( !MatrixContext.expandedRows ) {
                MatrixContext.expandedRows = [];
            }
            MatrixContext.expandedRows.push( parentRowUid );
            appCtxService.updateCtx( 'MatrixContext', MatrixContext );
        }
    } else {
        if( appCtxService.ctx.tlmTreeMode ) {
            sourceObjects.push( { uid: appCtxService.ctx.MatrixContext.peakSrcInfo.occurrence.uid } );
            if( !MatrixContext.expandedRows ) {
                MatrixContext.expandedRows = [];
            }
            MatrixContext.expandedRows.forEach( function( uid ) {
                sourceObjects.push( { uid: uid } );
            } );
            appCtxService.updateCtx( 'MatrixContext', MatrixContext );
        } else {
            sourceObjects = appCtxService.ctx.sourceObjects;
        }
    }

    if( data.eventData && data.eventData.colUid ) {
        var target = {
            uid: data.eventData.colUid
        };
        targetObjects.push( target );
        if( data.eventData.colUid === '-1' ) {
            targetObjects = appCtxService.ctx.targetObjects;
        }
        // in tree mode need to pass all expand columns
        if( appCtxService.ctx.tlmTreeMode ) {
            MatrixContext.parentCols = data.colObjects;
            MatrixContext.parentRows = data.rowObjects;
            parentColUid = data.eventData.colUid;
            if( !MatrixContext.expandedCols ) {
                MatrixContext.expandedCols = [];
            }
            MatrixContext.expandedCols.push( parentColUid );
            appCtxService.updateCtx( 'MatrixContext', MatrixContext );
        }
    } else {
        if( appCtxService.ctx.tlmTreeMode ) {
            targetObjects.push( { uid: appCtxService.ctx.MatrixContext.peakTargetInfo.occurrence.uid } );
            if( !MatrixContext.expandedCols ) {
                MatrixContext.expandedCols = [];
            }
            MatrixContext.expandedCols.forEach( function( uid ) {
                targetObjects.push( { uid: uid } );
            } );
            appCtxService.updateCtx( 'MatrixContext', MatrixContext );
        } else {
            targetObjects = appCtxService.ctx.targetObjects;
        }
    }

    if( data.matrixType === 'Dynamic Matrix' ) {
        var objects = [];
        for( var i = 0; i < data.rowObjects.length; i++ ) {
            if( data.rowObjects[ i ].occurrence ) {
                objects.push( { uid: data.rowObjects[ i ].occurrence.uid } );
            } else if( data.rowObjects[ i ].hiddenColumnObjects && data.rowObjects[ i ].hiddenColumnObjects.length > 0 ) {
                // For hidden objects
                data.rowObjects[ i ].hiddenColumnObjects.forEach( element => {
                    objects.push( { uid: element.occurrence.uid } );
                } );
            }
        }
        targetObjects = [];
        sourceObjects = objects;
    }
    var rowFilter = {};
    var colFilter = {};
    // if( MatrixContext.rowFilter && MatrixContext.rowFilter.categoriesInfo ) {
    //     var rowFiltercategoriesInfo = MatrixContext.rowFilter.categoriesInfo;
    //     var rowFilterCategories  = rowFiltercategoriesInfo.filterCategories;
    //     var rowFilterMap  = rowFiltercategoriesInfo.filterMap;
    //     rowFilter = {
    //         fetchUpdatedFilters: false,
    //         recipe: [],
    //         searchFilterCategories: rowFilterCategories,
    //         searchFilterFieldSortType: 'Priority',
    //         searchFilterMap: rowFilterMap,
    //         searchSortCriteria: []
    //     };
    // }

    // Filter Recipe not required for expand, this was only required in aw5.2.8. ACE works in same way

    // if( MatrixContext.rowFilter && MatrixContext.rowFilter.filter ) {
    //     rowFilter = MatrixContext.rowFilter.filter;
    // }
    // if( MatrixContext.colFilter && MatrixContext.colFilter.filter ) {
    //     colFilter = MatrixContext.colFilter.filter;
    // }
    if( MatrixContext.peakTargetInfo && MatrixContext.peakTargetInfo.occurrence.uid && MatrixContext.peakTargetInfo.occurrence.uid === MatrixContext.peakSrcInfo.occurrence.uid ) {
        colFilter = rowFilter;
    }

    if( data.eventData ) {
        reqTraceabilityMatrixService.setPageInfo( data, data.eventData.colPageToNavigate, data.eventData.rowPageToNavigate, undefined, undefined,
            data.eventData.displayRowFrom, data.eventData.displayColFrom );
    }

    var option = [];
    if( data.isReviseOps ) {
        option.push( 'startFreshNavigation' );
    }

    if( appCtxService.ctx.MatrixContext.sourceFilterReceipeCount > 0 || appCtxService.ctx.MatrixContext.targetFilterReceipeCount > 0 ) {
        option.push( 'APPLY_FILTER' ); // This this required to apply filter while expand all
    }

    appCtxService.updateCtx( 'targetObjects', targetObjects );
    appCtxService.updateCtx( 'sourceObjects', sourceObjects );

    var needAllData = appCtxService.ctx.tlmTreeMode || showEmptyRowsandColsActionState || appCtxService.ctx.MatrixContext.sortRow || appCtxService.ctx.MatrixContext.sortCol;
    var inputData = {
        sourceObjects: sourceObjects,
        targetObjects: targetObjects,
        relationTypes: appCtxService.ctx.MatrixContext.typeFilter && appCtxService.ctx.MatrixContext.typeFilter.filter ? appCtxService.ctx.MatrixContext.typeFilter.filter : [ 'ALL' ],
        actionPerformed: actionPerformed,
        srcContextInfo: srcPCI,
        targetContextInfo: targetPCI,
        itemsPerPage: needAllData ? -1 : itemsPerPage,
        traceMatrixObject: { uid: matrixObj },
        rowPageToNavigate: data.pageInfo.rowPageToNavigate,
        colPageToNavigate: data.pageInfo.colPageToNavigate,
        showChildTracelinks: data.showChildTracelinks || false,
        isRunInBackground: isRunInBackground,
        options: option,
        srcFilterInput: rowFilter,
        targetFilterInput: colFilter
    };
    data.isFullRollUp = false;
    data.showChildTracelinks = false;
    haveFullData = needAllData;
    data.dispatch( { path: 'data', value: data } );
    return inputData;
};

/**
 * load revised objects
 *
 * @param {object} data Input data
 */
export let loadObjects = function( data ) {
    if( data.isReviseOps ) {
        var selected = appCtxService.getCtx( 'MatrixContext.selectedOccurrence' );
        var uidsToLoad = [];
        uidsToLoad.push( selected[ 0 ].uid );
        soaSvc.post( 'Core-2007-09-DataManagement', 'loadObjects', {
            uids: uidsToLoad
        } ).then( function() {
            var obj = cdm.getObject( uidsToLoad );
            data.isReviseOps = false;
            data.dispatch( { path: 'data', value: data } );
            appCtxService.registerCtx( 'mselected', [ obj ] );
            appCtxService.registerCtx( 'selected', obj );
        } );
    }
};

/**
 * Create input for getInterfaces SOA
 *
 * @param {Object}
 *            ctx The context
 * @param {Object}
 *            data event data
 * @param {Boolean} - true, if creating input for save matrix
 *
 * @return {Array} input data for get interfaces
 */
export let getTraceMatrixInput = function( ctx, data, isSaveMatrix ) {
    var isAsyncCall = false;
    var showChildrenCount = false;
    var itemsPerPage = 25;

    var actionPerformed = 'TRAVERSE_CHILD';
    var srcPCI = {};
    var targetPCI = {};

    if( data ) {
        showChildrenCount = data.showChildCounts.dbValue;
        itemsPerPage = parseInt( data.noOfItem.dbValue ) || 25;
    }

    if( appCtxService.ctx.MatrixContext ) {
        srcPCI = appCtxService.ctx.MatrixContext.sourcePCI;
        targetPCI = appCtxService.ctx.MatrixContext.targetPCI;
        if( appCtxService.ctx.tlmTreeMode ) {
            resetTreeStructure();
        }
    }

    // For tree mode or removing empty all trace link info is needed, not just one page
    var needAllData = appCtxService.ctx.tlmTreeMode || !showEmptyRowsandColsActionState || appCtxService.ctx.MatrixContext.sortRow || appCtxService.ctx.MatrixContext.sortCol;

    var option = [];
    if( isSaveMatrix ) {
        option.push( 'PopulateRecipeCount' );
    } else {
        option.push( 'GENERATE_MATRIX' );
    }

    var inputData = {
        sourceObjects: appCtxService.ctx.sourceObjects,
        targetObjects: appCtxService.ctx.targetObjects,
        relationTypes: [ 'ALL' ],
        actionPerformed: actionPerformed,
        srcContextInfo: srcPCI,
        targetContextInfo: targetPCI,
        itemsPerPage: needAllData ? -1 : itemsPerPage,
        rowPageToNavigate: 1,
        colPageToNavigate: 1,
        showChildTracelinks: showChildrenCount,
        isRunInBackground: isAsyncCall,
        options: option
    };
    haveFullData = needAllData;
    return inputData;
};

/**
 * Sets page size of the traceability Matrix
 * @param {object} data Input data
 * @param {object} ctx context
 */
export let setPageSize = function( data, ctx ) {
    if( _data.noOfItem.dbValue ) {
        _page_size = data;
        _data.noOfItem.dbValue = _page_size;

        if( _page_size === 25 ) {
            appCtxService.registerCtx( 'highlightshow25items', true );
            appCtxService.registerCtx( 'highlightshow50items', false );
            appCtxService.registerCtx( 'highlightshow100items', false );
        } else if( _page_size === 50 ) {
            appCtxService.registerCtx( 'highlightshow25items', false );
            appCtxService.registerCtx( 'highlightshow50items', true );
            appCtxService.registerCtx( 'highlightshow100items', false );
        } else if( _page_size === 100 ) {
            appCtxService.registerCtx( 'highlightshow25items', false );
            appCtxService.registerCtx( 'highlightshow50items', false );
            appCtxService.registerCtx( 'highlightshow100items', true );
        }
    }
    processData( _data, appCtxService.ctx );
};

/**
 * toggleHeatMap
 *
 * Note: Do not want tracelink arrows if heatmap is on. if heatmap is on, then arrows check box will be false and disabled.
 *
 * @param {object} data Input data
 * @param {object} ctx Input ctx
 */
export let toggleHeatMap = function( data, ctx ) {
    if( data === 'heat' ) {
        appCtxService.registerCtx( 'highlightshowHeatmap', true );
        appCtxService.registerCtx( 'showTracelinkCount', !appCtxService.ctx.highlightshowHeatmap );
    } else {
        appCtxService.registerCtx( 'highlightshowHeatmap', false );
        appCtxService.registerCtx( 'showTracelinkCount', !appCtxService.ctx.highlightshowHeatmap );
    }
    var highlightshowHeatmap = appCtxService.getCtx( 'highlightshowHeatmap' );
    var showTracelinkCount = appCtxService.getCtx( 'showTracelinkCount' );

    var eventData = {
        showHeatmap: highlightshowHeatmap,
        showTracelinkCount: showTracelinkCount,
        showTracelinkDirection: appCtxService.ctx.showTracelinkDirection,
        matrixMode: appCtxService.ctx.tlmTreeMode
    };
    reqTraceabilityMatrixService.refreshMatrix( eventData );
};

/**
 * set no of items in a page to display
 * @param {Object}
 *            data - The panel's view model object
 */
export let getNoOfItemsPerPage = function( data ) {
    if( data.tracelinkInfo ) {
        if( data.showFullRollupCase || matrixType === 'Dynamic Matrix' ) {
            var page_size = parseInt( data.noOfItem.dbValue );
            var total_rows = data.rowObjects.length;
            var total_cols = data.colObjects.length;
            var totalRowPages = Math.ceil( total_rows / page_size );
            var totalColumnPages = Math.ceil( total_cols / page_size );

            reqTraceabilityMatrixService.setPageInfo( data, 1, 1, totalColumnPages, totalRowPages, 1, 1 );
            processData( data, appCtxService.ctx );
        } else {
            reqTraceabilityMatrixService.resetPageInfo( data );
            eventBus.publish( 'requirementDocumentation.loadMatrixData' );
        }
    }
};

/**
 * if user is in full Roll up, he cannot Navigate up and Down
 * @param {Object}
 *            data - The panel's view model object
 * @param {Object}
 *            ctx - The context
 */
export let isNavigationRequired = function( data ) {
    resetFullDataCache();
    eventBus.publish( 'requirementDocumentation.navigate', data.eventMap[ 'requirementTraceability.navigateUpOrDown' ] );
};

/** */
/**
 * collapse specified node
 * @param {Object} data - The panel's view model object
 * @param {Object} ctx context
 */
export let collapseNode = function( data, ctx ) {
    var rowUid = data.eventMap[ 'Arm0TraceabilityMatrix.collapseNode' ].rowUid;
    var colUid = data.eventMap[ 'Arm0TraceabilityMatrix.collapseNode' ].colUid;
    var matrixContext = appCtxService.getCtx( 'MatrixContext' );
    if( rowUid && matrixContext.expandedRows.indexOf( rowUid ) !== -1 ) {
        var newRows = [];
        var collapseRows = [ rowUid ];
        data.rowObjects.forEach( function( obj ) {
            if( collapseRows.includes( obj.parentUid ) ) {
                if( obj.isExpanded ) {
                    collapseRows.push( obj.occurrence.uid );
                }
            } else {
                //while collapsing check if previous is hidden and add flag
                var prevObj = newRows.pop();
                if( prevObj && prevObj.isHidden ) {
                    obj.isPreviousObjectHidden = true;
                } else {
                    obj.isPreviousObjectHidden = false;
                }
                if( prevObj ) {
                    newRows.push( prevObj );
                }
                newRows.push( obj );
            }
            if( obj.occurrence && obj.occurrence.uid === rowUid ) {
                obj.isExpanded = false;
            }
        } );
        data.rowObjects = newRows;
        matrixContext.parentRows = newRows;
        matrixContext.expandedRows = matrixContext.expandedRows.filter( uid => !collapseRows.includes( uid ) );
    }

    if( colUid && matrixContext.expandedCols.indexOf( colUid ) !== -1 ) {
        var newCols = [];
        var collapseCols = [ colUid ];
        data.colObjects.forEach( function( obj ) {
            if( collapseCols.includes( obj.parentUid ) ) {
                if( obj.isExpanded ) {
                    collapseCols.push( obj.occurrence.uid );
                }
            } else {
                //while collapsing check if previous is hidden and add flag
                var prevObj = newCols.pop();
                if( prevObj && prevObj.isHidden ) {
                    obj.isPreviousObjectHidden = true;
                } else {
                    obj.isPreviousObjectHidden = false;
                }
                if( prevObj ) {
                    newCols.push( prevObj );
                }
                newCols.push( obj );
            }
            if( obj.occurrence && obj.occurrence.uid === colUid ) {
                obj.isExpanded = false;
            }
        } );
        data.colObjects = newCols;
        matrixContext.parentCols = newCols;
        matrixContext.expandedCols = matrixContext.expandedCols.filter( uid => !collapseCols.includes( uid ) );
    }
    appCtxService.updateCtx( 'MatrixContext', matrixContext );
    processData( data, appCtxService.ctx );
    reqTraceabilityMatrixService.renderMatrixSelection();
    registerCtxIfHiddenObjPresent( data );
};

/**
 *  if user is in full Roll up, he cannot Navigate up and Down
 * @param {Object}
 *            data - The panel's view model object
 * @param {Object}
 *            ctx - The context
 */
export let isSoapaginationRequired = function( data ) {
    if( !data.isFullRollUp && data.matrixType !== 'Dynamic Matrix' ) {
        eventBus.publish( 'requirementDocumentation.navigate', data.eventMap[ 'requirementTraceability.uiPagination' ] );
    } else {
        reqTraceabilityMatrixService.setPageInfo( data, data.eventData.colPageToNavigate, data.eventData.rowPageToNavigate, null, null, data.eventData.displayRowFrom, data.eventData
            .displayColFrom );
        processData( data, appCtxService.ctx );
    }
};

/**
 * Filter links based on link type.
 * @param {Object}
 *            data event data
 * @param {Object}
 *            ctx - The context
 */
export let getSelectedTypeOfTraceLink = function( data, ctx ) {
    if( !data.eventData.selectedObjects[ 0 ] ) {
        return;
    }
    eventBus.publish( 'Arm0TraceabilityMatrix.saveScroll' );
    data.tlType = data.eventData.selectedObjects[ 0 ];
    data.tlType.dbValue = data.tlType.propInternalValue;
    _data.tlType = data.tlType;
    if( _data.tracelinkInfo ) {
        processData( _data, appCtxService.ctx );
    }

    data.dispatch( { path: 'data', value: data } );
    eventBus.publish( 'Arm0TracelinkMatrix.closeFunnelPopup' );
};

/**
 * pagination event for tracelink
 * @param {Object}
 *            data event data
 * @param {Object}
 *            ctx - The context
 */
export let performPagination = function( data, ctx ) {
    processData( data, appCtxService.ctx );
};

/**
 * event handler to open Trace link matrix settings panel
 */
export let openArm0TraceabilityMatrixSettings = function( input ) {
    const { commandContext } = input;
    const { dialogAction } = commandContext;
    if( input.commandId ) {
        if( dialogAction ) {
            let options = {
                view: input.commandId,
                parent: '.aw-layout-workareaMain',
                width: 'SMALL',
                height: 'FULL',
                isCloseVisible: false,
                subPanelContext: input.commandContext
            };
            dialogAction.show( options );
        } else {
            var ctx = appCtxService.input.ctx;
            commandPanelService.activateCommandPanel( 'Arm0TraceabilityMatrixSettings', '.aw-layout-workareaMain', ctx );
        }
    }
};

/**
 * event handler to save updated trace link matrix object
 */
export let refreshTracelinkMatrixObject = function() {
    eventBus.publish( 'Arm0TracelinkMatrixObject.refreshSavedTraceabilityMatrix' );
};

export let updateMatrixAsSaved = function( ctx, data ) {
    _data.isSaved = true;
    appCtxService.registerPartialCtx( 'MatrixContext.isMatrixSaved', true );
};

/**
 * To show updated traceabilty matrix
 *
 * @param {Object} ctx - The context
 * @param {Object} data - The panel's view model object
 */
export let showUpdatedTLMatrix = function( ctx, data ) {
    _data.isSaved = true;

    if( data && data.updatedTlMatrixObjectUids && data.updatedTlMatrixObjectUids.length > 0 ) {
        var updateTlMatrixObjectUid = data.updatedTlMatrixObjectUids[ 0 ];
        var updateTlMatrixObject = cdm.getObject( updateTlMatrixObjectUid );
        requirementsUtils.getTraceabilityMatrixFMSTicket( updateTlMatrixObject ).then( function( fmsTicket ) {
            loadTraceabilityMatrix( data, appCtxService.ctx, fmsTicket );
        } );
    }
};

/**
 * This function will load the properties of tracelink matrix object if necessary
 */
export let loadTMOproperties = function() {
    var arrModelObjs = [];
    var cellProp = [];
    var selectedObj = appCtxService.ctx.MatrixContext.matrixObj;
    if( selectedObj.uid ) {
        var selectedObjectRevision = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( selectedObj.uid ) );
        if( selectedObjectRevision && selectedObjectRevision.props && !selectedObjectRevision.props.last_mod_date ) {
            var tlMatrixObject = { uid: selectedObjectRevision.uid };
            arrModelObjs.push( tlMatrixObject );
            cellProp.push( 'last_mod_date' );
        }
    }
    if( arrModelObjs.length > 0 && cellProp.length > 0 ) {
        requirementsUtils.loadModelObjects( arrModelObjs, cellProp ).then( function() {} );
    }
};

/**
 * This function will return the Soa Input for saveViewModelEditAndSubmitWorkflow2
 * @param {Object} data event data
 * @return {object} soaInput input for the soa call
 */
export let buildInputForSaveEditingTMO = function( data ) {
    var inputs = [];
    var modifiedProperties = [];
    var selectedObj = appCtxService.ctx.MatrixContext.matrixObj;
    var selectedObjectRevision = reqTraceabilityMatrixService.getRevisionObject( cdm.getObject( selectedObj.uid ) );

    var obj = {
        uid: selectedObjectRevision.uid,
        type: selectedObjectRevision.type
    };
    var modifiedProperty = {
        propertyName: 'object_name',
        dbValues: [ data.name.dbValue ],
        uiValues: [ data.name.uiValue ],
        intermediateObjectUids: [],
        srcObjLsd: selectedObjectRevision.props.last_mod_date.dbValues[ 0 ],
        isModifiable: true
    };

    modifiedProperties.push( modifiedProperty );
    var input = {
        obj: obj,
        viewModelProperties: modifiedProperties,
        isPessimisticLock: false,
        workflowData: {}
    };
    inputs.push( input );
    return inputs;
};

/**
 * This function will return the Soa Input for saveTraceabilityMatrix
 * @return {object} inputData input for the soa call
 */
export let getTraceMatrixInputForSave = function() {
    var tracelinkInput;

    if( _data.matrixType === 'Full-Rollup Matrix' ) {
        tracelinkInput = exports.getTraceMatrixInput( appCtxService.ctx, _data, true );
        tracelinkInput.showChildTracelinks = true;
        tracelinkInput.isRunInBackground = true;
    } else {
        tracelinkInput = exports.getTraceMatrixInput( appCtxService.ctx, _data, true );
    }
    tracelinkInput.traceabilityMatrixObject = { uid: appCtxService.getCtx( 'MatrixContext' ).matrixObj.uid };

    var operation;

    if( _data.isSaved ) {
        operation = 'refresh';
        _data.isSaved = true;
    } else {
        operation = 'save';
        _data.isSaved = false;
    }

    if( _data.matrixType === 'Dynamic Matrix' ) {
        var objects = [];
        for( var i = 0; i < _data.rowObjects.length; i++ ) {
            if( _data.rowObjects[ i ].occurrence ) {
                objects.push( { uid: _data.rowObjects[ i ].occurrence.uid } );
            } else if( _data.rowObjects[ i ].hiddenColumnObjects && _data.rowObjects[ i ].hiddenColumnObjects.length > 0 ) {
                // For hidden objects
                _data.rowObjects[ i ].hiddenColumnObjects.forEach( element => {
                    objects.push( { uid: element.occurrence.uid } );
                } );
            }
        }
        tracelinkInput.sourceObjects = objects;
        tracelinkInput.targetObjects = [];
    }

    // To map with old soa
    tracelinkInput.relationType = tracelinkInput.relationTypes.toString(); // save soa needs relationType instead of relationTypes
    if( tracelinkInput.rowPageToNavigate ) {
        tracelinkInput.rowPageTonavigate = tracelinkInput.rowPageToNavigate;
    }
    if( tracelinkInput.showChildTracelinks ) {
        tracelinkInput.showChildrenTracelinks = tracelinkInput.showChildTracelinks;
    }
    delete tracelinkInput.relationTypes;
    delete tracelinkInput.rowPageToNavigate;
    delete tracelinkInput.showChildTracelinks;

    // Setting properties for save
    var settingProps = settingPropertiesToBeShown.toString();
    if( settingProps !== '' ) {
        tracelinkInput.options.push( 'MatrixSettingsProperties=' + settingProps );
    }
    if( appCtxService.ctx.showTracelinkDirection === true || appCtxService.ctx.showTracelinkDirection === 'true' ) {
        tracelinkInput.options.push( 'ShowArrows' );
    }

    return {
        tracelinkInput: tracelinkInput,
        matrixType: _data.matrixType,
        targetFolder: { uid: 'AAAAAAAAAAAAAA' },
        operation: operation
    };
};

/**
 * Update the sort information for traceablity matrix
 *
 * @param {DeclViewModel} data - The declViewModel data context object.
 */
export let sortTraceabilityMatrix = function( data, ctx ) {
    if( data.eventData.sortCol ) {
        appCtxService.registerPartialCtx( 'MatrixContext.sortCol', data.eventData.sortCol );
    }
    if( data.eventData.sortRow ) {
        appCtxService.registerPartialCtx( 'MatrixContext.sortRow', data.eventData.sortRow );
    }
    if( haveFullData ) {
        eventBus.publish( 'requirementDocumentation.processDataFromServer' );
    } else {
        refreshTraceabilityMatrix();
    }
};

/**
 * Update the showEmptyRowsandColsAction and persist it's state
 *
 * @param {DeclViewModel} data - The declViewModel data context object.
 */
export let showEmptyRowsAndColsAction = function() {
    showEmptyRowsandColsActionState = !showEmptyRowsandColsActionState;
    appCtxService.registerCtx( 'showEmpty', showEmptyRowsandColsActionState );

    reqTraceabilityMatrixService.resetPageInfo( _data );
    // Important: "haveFullData" is related to having all data from all pages.
    // useCachedData: is set to true to restore the empties that were removed.
    if( haveFullData ) {
        if( showEmptyRowsandColsActionState ) {
            // restore empty rows and columns that were filtered out
            useCachedData = true;
        }
        eventBus.publish( 'requirementDocumentation.processDataFromServer' );
    } else {
        if( showEmptyRowsandColsActionState ) {
            useCachedData = true;
        }
        eventBus.publish( 'requirementDocumentation.processDataFromServer' );
    }
};

/**
 * Update the showEmptyRowsandColsAction and persist it's state
 * @param {Boolean} showTracelinkDirection - The boolean to decide whether to show tracelink direction
 */
export let tracelinkDirectionChangeAction = function( showTracelinkDirection ) { // eslint-disable-line no-unused-vars
    reqTraceabilityMatrixService.tracelinkDirectionChangeAction( showTracelinkDirection );
};

/**
 * Set display name for given object
 * @param {object} obj Row or column object
 * @param {object} ctx Context with settings info
 */
var updateDisplayName = function( obj, ctx ) {
    obj.displayName = '';
    // Apply properties from setting
    settingPropertiesToBeShown.forEach( propName => {
        var property = _getSettingProperty( obj, propName );
        var propValue;
        if( !property && obj.persistentObject ) { // Get from model object, This can be the case with saved matrix (old data)
            var mo = cdm.getObject( obj.persistentObject.uid );
            if( mo.props[ propName ] ) {
                propValue = mo.props[ propName ].uiValues[ 0 ];
            }
        } else if( property ) {
            propValue = property.propValues[ 0 ];
        }
        if( propValue ) {
            if( obj.displayName !== '' ) {
                obj.displayName += ' - ' + propValue;
            } else {
                obj.displayName += propValue;
            }
        }
    } );

    // If display name not constructured from setting properties, in case of all properties unchecked on setting panel.
    if( obj.displayName === '' ) {
        obj.displayName += obj.name;
    }
};

/**
 * Update values
 * Also, DO NOT allow labels array to reach zero because cluster will look bad.
 *
 * @param {DeclViewModel} data - The declViewModel data context object.
 */
export let updateValues = function( data ) { // eslint-disable-line no-unused-vars
    var eventData = '';

    if( data.dbValue ) {
        var eventData = {
            label_state: true,
            label_display: data.uiValues[ 0 ]
        };
    } else {
        var eventData = {
            label_state: false,
            label_display: data.uiValues[ 0 ]
        };
    }
    eventBus.publish( 'Arm0TraceabilityMatrix.updateLabelValues', eventData );
};

/*
 * Determines if give links should be displayed based on link type filter.
 * @param {object} linkInfo Matrix cell info
 * @param {*} filterLinkType Trace link type name to filter on or ALL
 * @return {boolean} return true or false
 */
var isFilteredByType = function( linkInfo, filterLinkType ) {
    if( filterLinkType === localTextBundle.all ) {
        return true;
    }
    var isFiltered = false;
    var allLinksArray = linkInfo.complyingLinksInfo.concat( linkInfo.definingLinksInfo );
    // TODO if any link is filter out then all links for this cell are filtered out
    var count = 0;
    for( var index = 0; index < allLinksArray.length; index++ ) {
        if( allLinksArray[ index ].tracelink && allLinksArray[ index ].tracelink.type && allLinksArray[ index ].tracelink.type === filterLinkType ) {
            count += 1;
            isFiltered = true;
        }
    }
    linkInfo.numOfLinksOnChildren = count;
    return isFiltered;
};

/**
 * Process data Object for the tracelink generation
 * @param {object} data Data for rows, columns and link
 * @param {boolean} treeMode True if in tree mode
 */
var processData = function( data, ctx ) {
    // Create Sorting data to render icons based on sort type and criteria
    let sortEvtData = {};
    if( rowSort ) {
        sortEvtData.rowSort = rowSortType;
    }
    if( colSort ) {
        sortEvtData.colSort = colSortType;
    }
    if( individualRowSort ) {
        sortEvtData.individualRowSort = individualRowSortType;
    }
    if( individualColSort ) {
        sortEvtData.individualColSort = individualColSortType;
    }
    if( data && ctx ) {
        applyServiceData( data );
        var networkData = _makeDataCompliant( data, cellDataMap );

        appCtxService.registerCtx( 'showTracelinkCount', !appCtxService.ctx.highlightshowHeatmap );

        var eventData = {
            networkData: networkData,
            showHeatmap: appCtxService.ctx.highlightshowHeatmap,
            showTracelinkDirection: appCtxService.ctx.showTracelinkDirection,
            titleRowColumn: stuffLabelData( data ),
            targetParentObjectInfo: data.targetParentObjectInfo,
            srcParentObjectInfo: data.srcParentObjectInfo,
            pageInfo: data.pageInfo,
            showFullRollUpCase: data.showFullRollupCase === true ? data.showFullRollupCase : data.showChildCounts.dbValue,
            matrixMode: appCtxService.ctx.tlmTreeMode,
            sortType: sortEvtData
        };

        eventBus.publish( 'Arm0TraceabilityMatrix.refresh', eventData );
        reqTraceabilityMatrixService.refreshMatrix( eventData );
    } else {
        //use _data
        applyServiceData( _data );
        var networkData = _makeDataCompliant( _data, cellDataMap );

        var eventData = {
            networkData: networkData,
            showHeatmap: appCtxService.ctx.highlightshowHeatmap,
            showTracelinkDirection: appCtxService.ctx.showTracelinkDirection,
            titleRowColumn: stuffLabelData( _data ),
            targetParentObjectInfo: _data.targetParentObjectInfo,
            srcParentObjectInfo: _data.srcParentObjectInfo,
            pageInfo: _data.pageInfo,
            showFullRollUpCase: _data.showFullRollupCase === true ? _data.showFullRollupCase : _data.showChildCounts.dbValue,
            matrixMode: appCtxService.ctx.tlmTreeMode,
            sortType: sortEvtData
        };

        eventBus.publish( 'Arm0TraceabilityMatrix.refresh', eventData );
        reqTraceabilityMatrixService.refreshMatrix( eventData );
    }
};

/**
 * Set the indentation level for a row or column object
 * @param {object} node The row or column object
 * @param {object[]} parents Map of parent objects in tree
 */
var setLevel = function( node, parents ) {
    if( node.isParent && !node.isHidden ) {
        parents.set( node.occurrence.uid, node );
    }
    var parent = parents.get( node.parentUid );
    node.level = parent ? parent.level + 1 : 0;
};

/**
 * Convert data to input for heat Map
 * @param {object} data Data for rows, columns and links
 * @param {object} linkMap Map to get link info give source and target uid
 * @param {object} treeMode True if in tree mode
 * @return {Object} cellData of a grid
 */
// eslint-disable-next-line complexity
var _makeDataCompliant = function( data, linkMap ) {
    var row_nodes = [];
    var col_nodes = [];
    var links = [];
    var transformedData = {
        row_nodes: [],
        links: [],
        col_nodes: []
    };

    if( data.length <= 0 ) {
        return transformedData;
    }

    if( data.noOfItem === null ) {
        data.noOfItem = _data.noOfItem;
    }

    if( data.noOfItem.dbValue === null ) {
        data.noOfItem.dbValue = _page_size;
    }

    var page_size = parseInt( data.noOfItem.dbValue );

    if( !page_size ) {
        data.noOfItem.dbValue = _page_size;
        page_size = data.noOfItem.dbValue;
    }

    var ctx = appCtxService.ctx;
    var total_rows = data.rowObjects.length;
    var total_cols = data.colObjects.length;

    var colPageToNavigate = data.pageInfo.colPageToNavigate;
    var rowPageToNavigate = data.pageInfo.rowPageToNavigate;

    var startIndexRowItems = appCtxService.ctx.tlmTreeMode ? 0 : rowPageToNavigate - 1;
    var startIndexColItems = appCtxService.ctx.tlmTreeMode ? 0 : colPageToNavigate - 1;

    var totalRowPages = Math.ceil( total_rows / page_size );
    var totalColumnPages = Math.ceil( total_cols / page_size );

    if( colPageToNavigate > totalColumnPages ) {
        colPageToNavigate = totalColumnPages;
    }

    if( rowPageToNavigate > totalRowPages ) {
        rowPageToNavigate = totalRowPages;
    }

    reqTraceabilityMatrixService.setPageInfo( data, colPageToNavigate, rowPageToNavigate, totalColumnPages, totalRowPages, data.pageInfo.displayRowFrom, data.pageInfo.displayColFrom );
    var startIndexRowItems = appCtxService.ctx.tlmTreeMode ? 0 : ( rowPageToNavigate - 1 ) * page_size;
    var startIndexColItems = appCtxService.ctx.tlmTreeMode ? 0 : ( colPageToNavigate - 1 ) * page_size;

    // Create 1st row for column link totals
    var rowTotals = {
        sort: 0,
        name: '',
        uid: '',
        isParent: false,
        level: 0
    };
    row_nodes.push( rowTotals );

    var lengthOfRowLoop = startIndexRowItems + page_size > total_rows || appCtxService.ctx.tlmTreeMode ? total_rows : startIndexRowItems + page_size;

    var parents = new Map();
    for( var ir = startIndexRowItems; ir <= lengthOfRowLoop - 1; ir++ ) {
        var row = data.rowObjects[ ir ];
        if( row !== undefined ) {
            setLevel( row, parents );
            updateDisplayName( row, appCtxService.ctx );
            var rowData = {
                sort: ir,
                name: row.displayName,
                uid: !row.isHidden && row.occurrence.uid,
                isParent: data.matrixType !== 'Dynamic Matrix' ? row.isParent : false,
                type: !row.isHidden && row.persistentObject.type,
                level: row.level,
                parentUid: row.parentUid,
                isExpanded: row.isExpanded,
                isRow: true,
                isHidden: row.isHidden,
                isPreviousObjectHidden: row.isPreviousObjectHidden
            };
            if( row.isHidden ) {
                rowData.uid = row.hiddenID;
                rowData.hiddenColumnObjects = row.hiddenColumnObjects;
            }
            if( !row.isHidden ) {
                revToOccMap[ row.persistentObject.uid ] = row.occurrence.uid;
            }
            row_nodes.push( rowData );
        }
    }
    transformedData.row_nodes = row_nodes;

    // Create 1st column for row link totals
    var colTotals = {
        sort: 0,
        name: '',
        uid: '',
        isParent: false,
        level: 0
    };
    col_nodes.push( colTotals );

    var lengthOfColLoop = startIndexColItems + page_size > total_cols || appCtxService.ctx.tlmTreeMode ? total_cols : startIndexColItems + page_size;

    parents = new Map();
    for( var ic = startIndexColItems; ic <= lengthOfColLoop - 1; ic++ ) {
        var col = data.colObjects[ ic ];
        if( col !== undefined ) {
            setLevel( col, parents );
            updateDisplayName( col, appCtxService.ctx );
            var colData = {
                sort: ic,
                name: col.displayName,
                uid: !col.isHidden && col.occurrence.uid,
                isParent: data.matrixType !== 'Dynamic Matrix' ? col.isParent : false,
                type: !col.isHidden && col.persistentObject.type,
                level: col.level,
                parentUid: col.parentUid,
                isExpanded: col.isExpanded,
                isRow: false,
                isHidden: col.isHidden,
                isPreviousObjectHidden: col.isPreviousObjectHidden
            };
            if( col.isHidden ) {
                colData.uid = col.hiddenID;
                colData.hiddenColumnObjects = col.hiddenColumnObjects;
            }
            if( !col.isHidden ) {
                revToOccMap[ col.persistentObject.uid ] = col.occurrence.uid;
            }
            col_nodes.push( colData );
        }
    }
    transformedData.col_nodes = col_nodes;

    var filterLinkType = data.tlType.dbValue || localTextBundle.all;

    _handleNoSort( transformedData, data );

    for( var i = 0; i < transformedData.row_nodes.length; i++ ) {
        var rowUid = transformedData.row_nodes[ i ].uid;
        var rowTotalLinks;
        for( var j = 0; j < transformedData.col_nodes.length; j++ ) {
            var colUid = transformedData.col_nodes[ j ].uid;
            var myLink = {
                source: i,
                target: j,
                rowUid: rowUid,
                colUid: colUid,
                value: 0,
                numLinks: 0,
                direction: ''
            };

            // first column shows total for row, save it so it can be incremented.
            if( j === 0 ) {
                rowTotalLinks = myLink;
            }

            //If column is hidden then consider hidden columns trace link count to show in summation column
            if( colUid.indexOf( 'dummyHiddenID' ) === 0 ) {
                for( let index = 0; index < transformedData.col_nodes[ j ].hiddenColumnObjects.length; index++ ) {
                    var objColUID = transformedData.col_nodes[ j ].hiddenColumnObjects[ index ].occurrence.uid;
                    var key = rowUid.concat( '+' ).concat( objColUID );
                    createLinkInfo( linkMap, key, myLink, rowTotalLinks, links, j, filterLinkType, data, transformedData.row_nodes[ i ].level, transformedData.col_nodes[ j ].level );
                }
                links.push( myLink );
            }
            //If row is hidden then consider hidden row trace link count to show in summation row
            else if( rowUid.indexOf( 'dummyHiddenID' ) === 0 ) {
                for( let index = 0; index < transformedData.row_nodes[ i ].hiddenColumnObjects.length; index++ ) {
                    var objRowUID = transformedData.row_nodes[ i ].hiddenColumnObjects[ index ].occurrence.uid;
                    var key = objRowUID.concat( '+' ).concat( colUid );
                    createLinkInfo( linkMap, key, myLink, rowTotalLinks, links, j, filterLinkType, data, transformedData.row_nodes[ i ].level, transformedData.col_nodes[ j ].level );
                }
                links.push( myLink );
            } else {
                var key = rowUid.concat( '+' ).concat( colUid );
                createLinkInfo( linkMap, key, myLink, rowTotalLinks, links, j, filterLinkType, data, transformedData.row_nodes[ i ].level, transformedData.col_nodes[ j ].level );
                links.push( myLink );
            }
        }

        // Update row total cell
        if( rowTotalLinks && rowTotalLinks.numLinks > 0 ) {
            rowTotalLinks.value = rowTotalLinks.numLinks * 0.1 + 0.1;
            rowTotalLinks.text = rowTotalLinks.numLinks;
        }
    }

    for( var i = 0; i < transformedData.col_nodes.length; i++ ) {
        if( links[ i ].numLinks > 0 ) {
            links[ i ].text = links[ i ].numLinks;
            links[ i ].value = links[ i ].numLinks * 0.1 + 0.1;
        }
    }

    // give first row/column cell header large value so it won't move on sort
    links[ 0 ].value = 99999.9;
    transformedData.links = links;
    transformedData.showColor = appCtxService.ctx.highlightshowHeatmap;
    transformedData.showTraceLinks = appCtxService.ctx.showTracelinkDirection;
    transformedData.itemsPerPage = data.noOfItem.dbValue;
    if( !transformedData.itemPerPage ) {
        data.noOfItem.dbValue = _page_size;
        transformedData.itemPerPage = data.noOfItem.dbValue;
    }

    transformedData.i18n = data.i18n;
    transformedData.subPanelContext = data.subPanelContext;
    // set compare function to use for sorting
    transformedData.nodeCompareFunction = function( nodeArray, a, b ) {
        // use array index as secondary sort key to make the sort stable (nodes with equal value stay in same order)
        return nodeArray[ b ].value === nodeArray[ a ].value ? a - b : nodeArray[ b ].value - nodeArray[ a ].value;
    };
    data.dispatch( { path: 'data', value: data } );
    return transformedData;
};

/**
 * Creates trace link information to be shown in cell
 */
var createLinkInfo = function( linkMap, key, myLink, rowTotalLinks, links, j, filterLinkType, data, rowLevel, colLevel ) {
    var linkInfo = linkMap[ key ];
    var deepCopiedLinkInfo = _.cloneDeep( linkInfo );
    if( linkInfo && isFilteredByType( deepCopiedLinkInfo, filterLinkType ) ) {
        myLink.numLinks = deepCopiedLinkInfo.numOfLinksOnChildren;
        myLink.direction = linkInfo.tracelinkDirection;
        // set color intensity based on number of links
        var total = myLink.numLinks;
        if( total > 0 ) {
            myLink.value = total * 0.1 + 0.1;
        }

        if( data.matrixType === 'Full-Rollup Matrix' && ( rowLevel > 0 || colLevel > 0 ) ) {
            // No need to update total count for childs expands in case of Full-Roll up
        } else {
            // add links to total for row and column
            rowTotalLinks.numLinks += total;
            links[ j ].numLinks += total;
        }

        myLink.text = getCellValue( deepCopiedLinkInfo, data.showChildCounts.dbValue );
    }
};
/**
 * IMPORTANT: This gets called when our viewModel gets unMounted to clear storage and globals when matrix gets destroyed
 */
var destroyTraceabilityMatrix = function() {
    if( _data ) {
        _data = null;
    }
};
/****************** Hide / Unhide Objects Related Code *************************************/
/**
 * Creates dummy hidden object
 *  @param {object} previousObject previous object of selected node
 * @param {object} data Input data
 * @returns {Object} - Json object
 */
var createDummyHiddenObject = function( previousObject, obj ) {
    var dummyHiddenObject = {
        colIndex: 0,
        displayName: '',
        id: '',
        isHidden: true,
        isParent: true,
        level: 0,
        name: '',
        hiddenColumnObjects: [],
        parentUid: obj.parentUid
    };
    if( previousObject && previousObject.isHidden ) {
        dummyHiddenObject.isPreviousObjectHidden = true;
    }
    dummyHiddenObject.hiddenID = 'dummyHiddenID' + Math.random().toString( 36 ).substr( 2, 10 );
    dummyHiddenObject.hiddenColumnObjects.push( obj );
    return dummyHiddenObject;
};

/**
 * Removes children of object to be hidden
 *  @param {object} selectedObj selected node
 * @param {object} colObjects column/ row objects
 *  @returns {Object} - Json object
 */
var removeChildren = function( selectedObj, colObjects ) {
    var collapseCols = selectedObj;
    var collapsedNode = [];
    for( let index = 0; index < colObjects.length; index++ ) {
        var object = colObjects[ index ];

        //Hides all childs of selected object
        if( collapseCols.includes( object.parentUid ) ) {
            if( object.isExpanded ) {
                collapseCols.push( object.occurrence.uid );
            }
        } else {
            var prevObj = collapsedNode.pop();
            if( prevObj && prevObj.isHidden ) {
                object.isPreviousObjectHidden = true;
            } else {
                object.isPreviousObjectHidden = false;
            }
            if( prevObj ) {
                collapsedNode.push( prevObj );
            }
            if( collapseCols.includes( object.occurrence && object.occurrence.uid ) ) {
                object.isExpanded = false;
            }
            collapsedNode.push( object );
        }
    }
    return collapsedNode;
};

/**
 * Returns array of selected object ID's
 *  @returns {Object} - Json object
 */
var getSelectedObjectIDs = function() {
    var selectedObjs = [];
    for( let index = 0; index < appCtxService.ctx.mselected.length; index++ ) {
        var element = appCtxService.ctx.mselected[ index ].uid;
        if( revToOccMap[ element ] ) {
            selectedObjs.push( revToOccMap[ element ] );
        }
    }
    return selectedObjs;
};

/**
 * Unhides selected node
 *  @param {object} objects All row/column objects
 *  @param {object} ele dummy object which contains array of hidden object
 *  @param {object} index index of element to be unhide
 *  @returns {Object} - Json object
 */
var unhide = function( objects, ele, index ) {
    if( objects[ index + 1 ] ) {
        objects[ index + 1 ].isPreviousObjectHidden = false;
    }
    var hiddenObjects = ele.hiddenColumnObjects;
    hiddenObjects.forEach( function( element, i ) {
        element.isHidden = false;
        if( i === 0 ) {
            if( objects[ index - 1 ] && objects[ index - 1 ].isHidden ) {
                element.isPreviousObjectHidden = true;
            } else {
                element.isPreviousObjectHidden = false;
            }
        } else {
            element.isPreviousObjectHidden = false;
        }
    } );
    //replace dummy object with all hidden objects
    objects.splice.apply( objects, [ index, 1 ].concat( hiddenObjects ) );
    return objects;
};

/**
 * Register ctx if hidden object present in matrix
 *  @param {object} data Input data element
 */
var registerCtxIfHiddenObjPresent = function( data ) {
    var isHiddenObjectsPresent = false;
    //Update ctx if any column is hidden
    for( let index = 0; index < data.colObjects.length; index++ ) {
        if( data.colObjects[ index ].isHidden ) {
            isHiddenObjectsPresent = true;
            break;
        }
        isHiddenObjectsPresent = false;
    }
    //If no column is hidden then check if row is hidden
    if( !isHiddenObjectsPresent ) {
        for( let index = 0; index < data.rowObjects.length; index++ ) {
            if( data.rowObjects[ index ].isHidden ) {
                isHiddenObjectsPresent = true;
                break;
            }
            isHiddenObjectsPresent = false;
        }
    }
    appCtxService.registerCtx( 'isHiddenObjectsPresent', isHiddenObjectsPresent );
};

/**
 * Updated flag if previous element is hidden
 *  @param {object} columnObjects All row/column objects
 *  @param {object} obj selected node
 *  @param {object} index index of hidden element
 */
var chekIfPreviousHidden = function( columnObjects, obj, indexOfHidden ) {
    if( columnObjects[ indexOfHidden - 1 ] && columnObjects[ indexOfHidden - 1 ].isHidden ) {
        obj.isPreviousObjectHidden = true;
    } else {
        obj.isPreviousObjectHidden = false;
    }
};

/**
 * Enable unhide option.
 */
var enableUnhiding = function() {
    var filterButtonElement = document.getElementsByClassName( 'unhide-button' )[ 0 ];
    filterButtonElement.classList.remove( 'disabled' );
};

/**
 * Disable unhide option.
 */
var disableUnhiding = function() {
    var filterButtonElement = document.getElementsByClassName( 'unhide-button' )[ 0 ];
    filterButtonElement.classList.add( 'disabled' );
};

/**
 * Check if all facets are checked
 *
 * @param {Object} data Input data element
 * @returns {Boolean} true if all facets are selected
 */
var isFacetInputDefault = function( data ) {
    var isInputDefault = true;
    if( data.columnValues ) {
        _.forEach( data.columnValues, function( currentValue ) {
            if( !currentValue.dbValue ) {
                isInputDefault = false;
                return false;
            }
            return true;
        } );
    }
    return isInputDefault;
};

/**
 * Check if all facets are unchecked
 *
 * @param {Object} column column definition object
 * @returns {Boolean} true if all facets are deselected
 */
var areAllFacetsUnchecked = function( data ) {
    var allFacetsUnchecked;
    if( data.columnValues && !isFacetInputDefault( data ) ) {
        allFacetsUnchecked = true;
        _.forEach( data.columnValues, function( currentValue ) {
            if( currentValue.dbValue ) {
                allFacetsUnchecked = false;
                return false;
            }
            return true;
        } );
    }
    return allFacetsUnchecked;
};

/**
 * Get the filtered objects
 *
 * @param {Object} filter - Filter value
 * @param {Object} data - The view model data
 * @returns {Object} - Json object
 *
 */
var _getFilteredObjects = function( filter, data ) {
    var propertiesToSelect = [];

    var propInfos = data.columnValuesWithoutFilter;

    var filterValue = filter.toLocaleLowerCase().replace( /\\|\s/g, '' );

    //Don't show objects unless the filter matches
    if( filterValue !== '' ) {
        for( var i = 0; i < propInfos.length; i++ ) {
            var propInfo = propInfos[ i ];

            var propertyDisplayName = propInfo.propertyDisplayName.toLocaleLowerCase().replace( /\\|\s/g, '' );
            if( propertyDisplayName.indexOf( filterValue ) !== -1 || compare( filterValue, propertyDisplayName ) ) {
                propertiesToSelect.push( propInfo );
            }
        }
    } else {
        propertiesToSelect = data.columnValuesWithoutFilter;
    }
    return propertiesToSelect;
};

/**
 * Function to compare both strings
 */
function compare( first, second ) {
    // If we reach at the end of both strings
    if( first.length === 0 && second.length === 0 ) { return true; }

    if( first.length > 1 && first[ 0 ] === '*' && second.length === 0 ) {
        return false;
    }
    // If the first string contains '?' or current characters of both strings match
    if( first.length > 1 && first[ 0 ] === '?' || first.length !== 0 && second.length !== 0 && first[ 0 ] === second[ 0 ] ) {
        return compare( first.substring( 1 ), second.substring( 1 ) );
    }
    if( first.length > 0 && first[ 0 ] === '*' ) {
        return compare( first.substring( 1 ), second ) || compare( first, second.substring( 1 ) );
    }
    if( first.length === 1 && first[ 0 ] === '?' ) {
        return true;
    }
    return false;
}
/**
 * event handler to call hide row/ column function
 */
export let callHideRow = function() {
    eventBus.publish( 'Arm0Traceability.hideRowOrColumn' );
};

/**
 * event handler to unhide all funtion
 */
export let callUnhideAll = function() {
    eventBus.publish( 'Arm0Traceability.unhideAll' );
};

/**
 * Hides selected nodes
 *  @param {object} data Data for rows, columns and link
 * @param {boolean} ctx global ctx
 */
// eslint-disable-next-line complexity
export let hideRowOrColumn = function( data, ctx ) {
    var selectedObjs = getSelectedObjectIDs();
    var isHiddenObjectsPresent = false;
    //Column hiding logic
    if( selectedObjs.length > 0 ) {
        var iscolHidden = false;
        var collapsedNode;
        //Create array after removing children of element to be hidden
        if( appCtxService.ctx.MatrixContext.isRowSelected ) {
            collapsedNode = removeChildren( selectedObjs, data.rowObjects );
        } else {
            collapsedNode = removeChildren( selectedObjs, data.colObjects );
        }

        //Hide selected node
        for( let j = 0; j < selectedObjs.length; j++ ) {
            var newCols = [];
            var selectedObj = selectedObjs[ j ];
            for( let index = 0; index < collapsedNode.length; index++ ) {
                var obj = collapsedNode[ index ];

                if( obj.occurrence && obj.occurrence.uid === selectedObj || obj.persistentObject && obj.persistentObject.uid === selectedObj ) {
                    obj.isHidden = true;
                    iscolHidden = true;
                    isHiddenObjectsPresent = true;
                    var popObject = newCols.pop();
                    //Check if previous and next object is hidden and they are at same level
                    if( popObject !== undefined && popObject.isHidden && popObject.parentUid === obj.parentUid &&
                        index + 1 < collapsedNode.length && collapsedNode[ index + 1 ].isHidden && collapsedNode[ index + 1 ].parentUid === obj.parentUid ) {
                        popObject.hiddenColumnObjects.push( obj );
                        var nextIndexObject = collapsedNode[ index + 1 ];
                        for( let k = 0; k < nextIndexObject.hiddenColumnObjects.length; k++ ) {
                            var element = nextIndexObject.hiddenColumnObjects[ k ];
                            popObject.hiddenColumnObjects.push( element );
                        }

                        newCols.push( popObject );
                        index++;
                    }
                    //Check if previous object is hidden and at same level
                    else if( popObject !== undefined && popObject.isHidden && popObject.parentUid === obj.parentUid ) {
                        popObject.hiddenColumnObjects.push( obj );
                        newCols.push( popObject );
                    }
                    //Check if next object is hidden and at same level
                    else if( index + 1 < collapsedNode.length && collapsedNode[ index + 1 ] &&
                        collapsedNode[ index + 1 ].isHidden && collapsedNode[ index + 1 ].parentUid === obj.parentUid ) {
                        var object = collapsedNode[ index + 1 ];
                        object.hiddenColumnObjects.splice( 0, 0, obj );
                        if( popObject && popObject.isHidden ) {
                            object.isPreviousObjectHidden = true;
                        }
                        if( popObject ) {
                            newCols.push( popObject );
                        }
                        newCols.push( object );
                        index++;
                        //Push at correct location obj[index + 1]
                    } else {
                        if( popObject ) {
                            newCols.push( popObject );
                        }
                        newCols.push( createDummyHiddenObject( popObject, obj ) );
                    }
                } else {
                    if( iscolHidden ) {
                        obj.isPreviousObjectHidden = true;
                        iscolHidden = false;
                    }
                    newCols.push( obj );
                }
            }
            iscolHidden = false;
            collapsedNode = newCols;
        }
        if( appCtxService.ctx.MatrixContext.isRowSelected ) {
            data.rowObjects = newCols;
            _data.rowObjects = newCols;
            appCtxService.registerPartialCtx( 'MatrixContext.parentRows', data.rowObjects );
        } else {
            data.colObjects = newCols;
            _data.colObjects = newCols;
            appCtxService.registerPartialCtx( 'MatrixContext.parentCols', data.colObjects );
        }
    }
    processData( data, appCtxService.ctx );
    reqTraceabilityMatrixService._handleUnselection();
    appCtxService.registerCtx( 'isHiddenObjectsPresent', isHiddenObjectsPresent );
    popupService.hide();
    return {
        rowObjects: data.rowObjects,
        colObjects: data.colObjects
    };
};

/**
 * Create data for hidden object balloon popup
 * @param {object} data Data for rows, columns
 * @param {boolean} ctx global ctx
 */
export let createPopupData = function( data, ctx ) {
    var hiddenObject = data.subPanelContext.eventData;
    var columnValues = hiddenObject.hiddenColumnObjects;
    var hiddenObjects = [];

    for( let index = 0; index < columnValues.length; index++ ) {
        var element = columnValues[ index ];
        var currentValue = createFacetProp( hiddenObject, element, data );
        currentValue.element = element;
        currentValue.hiddenObject = hiddenObject;
        hiddenObjects.push( currentValue );
    }

    //Create tooltip label
    var hiddenObjectCountLabel;
    if( hiddenObject.isRow && data.i18n && data.i18n.hiddenRowsLabel ) {
        hiddenObjectCountLabel = data.i18n.hiddenRowsLabel.replace( '{0}', hiddenObjects.length );
    } else if( data.i18n && data.i18n.hiddenColumnLabel ) {
        hiddenObjectCountLabel = data.i18n.hiddenColumnLabel.replace( '{0}', hiddenObjects.length );
    }
    data.hiddenObjectCountLabel = {};
    data.hiddenObjectCountLabel = hiddenObjectCountLabel;
    return {
        hiddenObjectCountLabel: hiddenObjectCountLabel,
        columnValues: hiddenObjects,
        columnValuesWithoutFilter: hiddenObjects
    };
};

/**
 * Unhides all object from selected node on double click
 * @param {object} eventData eventData contains selected node info
 * @param {object} data Data for rows, columns
 * @param {boolean} ctx global ctx
 */
export let UnhideAllFromSelected = function( eventData, data, ctx ) {
    var objects;
    if( eventData.isRow ) {
        objects = data.rowObjects;
    } else {
        objects = data.colObjects;
    }
    for( var i = 0; i < eventData.unhideObjects.length; i++ ) {
        var ele = objects.filter( element => element.hiddenID === eventData.unhideObjects[ i ] );
        if( ele.length > 0 ) {
            var index = objects.indexOf( ele[ 0 ] );
            objects = unhide( objects, ele[ 0 ], index );
        }
    }
    if( eventData.isRow ) {
        data.rowObjects = objects;
    } else {
        data.colObjects = objects;
    }
    appCtxService.registerPartialCtx( 'MatrixContext.parentCols', data.colObjects );
    appCtxService.registerPartialCtx( 'MatrixContext.parentRows', data.rowObjects );
    processData( data, appCtxService.ctx );
    reqTraceabilityMatrixService._handleUnselection();
    registerCtxIfHiddenObjPresent( data );
    popupService.hide();
};

/**
 * Unhides all object in the matrix
 * @param {object} data Data for rows, columns
 * @param {boolean} ctx global ctx
 */
export let unhideAll = function( data, ctx ) {
    //unhides all hidden columns
    for( let index = 0; index < data.colObjects.length; index++ ) {
        var element = data.colObjects[ index ];
        if( element.isHidden ) {
            var unhiddenCol = unhide( data.colObjects, element, index );
            data.colObjects = unhiddenCol;
            //index changes as length of colObjects changes after unhiding elements
            index += element.hiddenColumnObjects.length - 1;
        }
    }
    //unhides all hidden rows
    for( let rowIndex = 0; rowIndex < data.rowObjects.length; rowIndex++ ) {
        var rowElement = data.rowObjects[ rowIndex ];
        if( rowElement.isHidden ) {
            var unhiddenRow = unhide( data.rowObjects, rowElement, rowIndex );
            data.rowObjects = unhiddenRow;
            //index changes as length of rowObjects changes after unhiding elements
            rowIndex += rowElement.hiddenColumnObjects.length - 1;
        }
    }
    appCtxService.registerPartialCtx( 'MatrixContext.parentCols', data.colObjects );
    appCtxService.registerPartialCtx( 'MatrixContext.parentRows', data.rowObjects );
    processData( data, appCtxService.ctx );
    appCtxService.registerCtx( 'isHiddenObjectsPresent', false );
    reqTraceabilityMatrixService._handleUnselection();
};

/**
 * Unhides selected elements from balloon popup
 *  @param {boolean} column selected column from which elements to unhide
 *  @param {object} data Data for rows, columns and link
 * @param {boolean} ctx global ctx
 */
export let unhideSelected = function( column, data, ctx ) {
    var hiddenUnhiddenObjs = [];
    var hiddenObj = column[ 0 ].hiddenObject.hiddenColumnObjects;
    var unhideColumns = [];
    //get list of elements to unhide
    column.forEach( element => {
        if( element.dbValue ) {
            unhideColumns.push( element );
        }
    } );
    var objects;
    if( column[ 0 ].hiddenObject.isRow ) {
        objects = _data.rowObjects;
    } else {
        objects = _data.colObjects;
    }
    //get index of hidden object
    var ele = objects.filter( element => element.hiddenID === column[ 0 ].hiddenObject.uid );
    var indexOfHidden = objects.indexOf( ele[ 0 ] );
    for( var j = 0; j < unhideColumns.length; j++ ) {
        for( var index = 0; index < hiddenObj.length; index++ ) {
            //Unhides ticked elements and change isHidden and isPreviousObjectHidden flags
            if( j < unhideColumns.length && hiddenObj[ index ] === unhideColumns[ j ].element ) {
                //check if previous element is hidden in new hiddenUnhiddenObjs list
                if( hiddenUnhiddenObjs.length > 0 ) {
                    var obj = hiddenUnhiddenObjs.pop();
                    if( obj.isHidden ) {
                        unhideColumns[ j ].element.isPreviousObjectHidden = true;
                    } else {
                        unhideColumns[ j ].element.isPreviousObjectHidden = false;
                    }
                    hiddenUnhiddenObjs.push( obj );
                }
                //check if previous element is hidden in column objects
                else {
                    chekIfPreviousHidden( objects, unhideColumns[ j ].element, indexOfHidden );
                }
                unhideColumns[ j ].element.isHidden = false;
                hiddenUnhiddenObjs.push( unhideColumns[ j ].element );
                j++;
            } //If not ticked then create newHidden element and push object in it
            else {
                //Check in new hiddenUnhiddenObjs list if previous is hidden
                if( hiddenUnhiddenObjs.length > 0 ) {
                    //If previous hidden then push inside same element
                    var obj1 = hiddenUnhiddenObjs.pop();
                    if( obj1.isHidden ) {
                        obj1.hiddenColumnObjects.push( hiddenObj[ index ] );
                        hiddenUnhiddenObjs.push( obj1 );
                    }
                    //If previous not hidden then create newHidden element
                    else {
                        chekIfPreviousHidden( objects, hiddenObj[ index ], indexOfHidden );
                        var hiddendummyObj = createDummyHiddenObject( obj1, hiddenObj[ index ] );
                        hiddenUnhiddenObjs.push( obj1 );
                        hiddenUnhiddenObjs.push( hiddendummyObj );
                    }
                } else {
                    chekIfPreviousHidden( objects, hiddenObj[ index ], indexOfHidden );
                    var hiddendummyObj = createDummyHiddenObject( null, hiddenObj[ index ] );
                    hiddendummyObj.isPreviousObjectHidden = hiddenObj[ index ].isPreviousObjectHidden;
                    hiddenUnhiddenObjs.push( hiddendummyObj );
                }
            }
        }
    }
    var ele1 = objects.filter( element => element.hiddenID === column[ 0 ].hiddenObject.uid );
    var index = objects.indexOf( ele1[ 0 ] );
    if( hiddenUnhiddenObjs[ hiddenUnhiddenObjs.length - 1 ] && !hiddenUnhiddenObjs[ hiddenUnhiddenObjs.length - 1 ].isHidden && objects[ index + 1 ] ) {
        objects[ index + 1 ].isPreviousObjectHidden = false;
    }
    objects.splice.apply( objects, [ index, 1 ].concat( hiddenUnhiddenObjs ) );
    if( column[ 0 ].hiddenObject.isRow ) {
        _data.rowObjects = objects;
        appCtxService.registerPartialCtx( 'MatrixContext.parentRows', objects );
    } else {
        _data.colObjects = objects;
        appCtxService.registerPartialCtx( 'MatrixContext.parentCols', objects );
    }
    processData( _data, appCtxService.ctx );
    popupService.hide();
    reqTraceabilityMatrixService._handleUnselection();
    registerCtxIfHiddenObjPresent( _data );
};

/**
 * Updates the select all prop change value fire event
 *  @param {object} data Data for rows, columns and link
 */
export let updateSelectAllProp = function( data ) {
    // Set select All mode
    if( data.selectAllProp.dbValue === false ) {
        data.isSelectedFacetValues = true;
        _.forEach( data.columnValues, function( value ) {
            if( value.dbValue ) {
                value.dbValues = false;
                uwPropertySvc.setValue( value, false );
            }
        } );
    } else {
        data.isSelectedFacetValues = false;
        _.forEach( data.columnValues, function( value ) {
            if( !value.dbValue ) {
                value.dbValues = true;
                uwPropertySvc.setValue( value, true );
            }
        } );
    }
    filterFacetInputChanged( data );
    return data.isSelectedFacetValues;
};

/**
 * Creates a prop for facet values
 *
 * @param {String} hiddenObject - dummy hidden object
 * @param {Object} element - create prop for single element
 * @param {object} data Data for rows, columns
 * @returns {Object} The created prop
 */
export let createFacetProp = function( hiddenObject, element, data ) {
    let prop = {
        displayName: element.displayName,
        type: 'BOOLEAN',
        isEditable: true,
        dbValue: true,
        labelPosition: 'PROPERTY_LABEL_AT_RIGHT'
    };
    return modelPropertySvc.createViewModelProperty( prop );
};

/**
 * Updates the select all prop change value fire event
 *  @param {object} data Data for rows, columns and link
 */
export let updateColumnValuesProp = function( data ) {
    // check if every element but first is selected
    var uncheckedCount = 0;
    var isSelectedAllFacetValue;
    _.forEach( data.columnValues, function( value ) {
        if( !value.dbValue ) {
            uncheckedCount++;
            return false;
        }
        return true;
    } );
    if( uncheckedCount === 0 ) {
        isSelectedAllFacetValue = false;
        uwPropertySvc.setValue( data.selectAllProp, true );
    } else {
        isSelectedAllFacetValue = true;
        uwPropertySvc.setValue( data.selectAllProp, false );
    }
    filterFacetInputChanged( data );

    return isSelectedAllFacetValue;
};

/**
 * Facet value changes, revalidate unhide option visibility
 *
 * @param {object} data Data for rows, columns
 */
export let filterFacetInputChanged = function( data ) {
    if( !isFacetInputDefault( data ) && ( areAllFacetsUnchecked( data ) || data.columnValues.length === 0 ) ) {
        disableUnhiding();
    } else {
        enableUnhiding();
    }
};

/**
 * Filter based on text entered
 *
 * @param {object} data Data for rows, columns
 */
export var filterAction = function( data ) {
    var filter = '';
    if( 'textValueToFilter' in data && 'dbValue' in data.textValueToFilter ) {
        filter = data.textValueToFilter.dbValue;
    }
    filterFacetInputChanged( data );
    data.columnValues = _getFilteredObjects( filter, data );
    var noFacetResults = false;
    if( data.columnValues.length === 0 ) {
        noFacetResults = true;
    }
    return {
        columnValues: data.columnValues,
        noFacetResults: noFacetResults
    };
};
/**************************************** Upto Here ********************************************************* */

export let performExpandBelow = function( levelsToExpand ) {
    var selected = appCtxService.getCtx( 'MatrixContext.selectedOccurrence' );
    var isRow = appCtxService.getCtx( 'MatrixContext.isRowSelected' );
    var eventData = {};
    if( isRow ) {
        var expandOption1 = parseInt( levelsToExpand ) > 0 ? 'EXPAND_ROW=' + parseInt( levelsToExpand ) : 'EXPAND_ROW';
        eventData = {
            rowUid: selected[ 0 ].uid,
            rowPageToNavigate: 1,
            expandOption: expandOption1
        };
    } else {
        var expandOption2 = parseInt( levelsToExpand ) > 0 ? 'EXPAND_COL=' + parseInt( levelsToExpand ) : 'EXPAND_COL';
        eventData = {
            colUid: selected[ 0 ].uid,
            colPageToNavigate: 1,
            expandOption: expandOption2
        };
    }
    eventBus.publish( 'requirementTraceability.navigateUpOrDown', eventData );
};

export let performCollapseBelow = function() {
    var selected = appCtxService.getCtx( 'MatrixContext.selectedOccurrence' );
    var isRow = appCtxService.getCtx( 'MatrixContext.isRowSelected' );
    var eventData;
    if( isRow ) {
        eventData = { rowUid: selected[ 0 ].uid };
    } else {
        eventData = { colUid: selected[ 0 ].uid };
    }
    eventBus.publish( 'Arm0TraceabilityMatrix.collapseNode', eventData );
};

export let isReviseOperation = function( data, ctx ) {
    let obj = cdm.getObject( appCtxService.ctx.selected.uid );
    let objItem = cdm.getObject( obj.props.items_tag.dbValues[ 0 ] );
    let itemRevArray = objItem.props.revision_list.dbValues;
    let latestRevID = itemRevArray[ itemRevArray.length - 1 ];
    if( latestRevID !== appCtxService.ctx.selected.uid ) {
        return true;
    }
    return false;
};

/*
 *Start ==> THIS SECTION CONTAINS METHODS RELATED TO MANAGE AND HANDLE SORTING ON THE TRACEABILITY MATRIX SVG
 */
const _handleNoSort = ( transformedData, data ) => {
    // Process row elements for no sorting
    if( noSortRow ) {
        let maxLevel = -1;
        if( appCtxService.ctx.MatrixContext.expandedRows && appCtxService.ctx.MatrixContext.expandedRows ) {
            let expandedRow = [ ...appCtxService.ctx.MatrixContext.expandedRows ];

            // Find max level of row child and mark expanded rows
            transformedData.row_nodes.forEach( row => {
                if( row.level > maxLevel ) {
                    maxLevel = row.level;
                }

                for( let i = expandedRow.length - 1; i >= 0; i-- ) {
                    if( expandedRow[ i ] === row.uid ) {
                        row.isExpanded = true;
                        expandedRow.splice( i, 0 );
                    }
                }
            } );
        } else {
            maxLevel = 0; // For List mode (dynamic matrix)
        }

        // Process and handle no sort for rows
        transformedData.row_nodes = _getElementsInHierarachy( transformedData.row_nodes, maxLevel );
        data.rowObjects = _sortByLevelHierarachy( data.rowObjects, maxLevel );
        appCtxService.registerPartialCtx( 'MatrixContext.parentRows', data.rowObjects );
        _data.rowObjects = data.rowObjects;
        noSortRow = false;
        registerCtxIfHiddenObjPresent( data );
    }

    // Process column elements for no sorting
    if( noSortCol ) {
        let maxLevel = -1;
        if( appCtxService.ctx.MatrixContext && appCtxService.ctx.MatrixContext.expandedCols ) {
            let expandedCol = [ ...appCtxService.ctx.MatrixContext.expandedCols ];

            // Find max level of column child and mark expanded columns
            transformedData.col_nodes.forEach( col => {
                if( col.level > maxLevel ) {
                    maxLevel = col.level;
                }

                for( let i = expandedCol.length - 1; i >= 0; i-- ) {
                    if( expandedCol[ i ] === col.uid ) {
                        col.isExpanded = true;
                        expandedCol.splice( i, 0 );
                    }
                }
            } );
        } else {
            maxLevel = 0; // In case of List mode (for dynamic matrix)
        }

        // Process and handle no sort for columns
        transformedData.col_nodes = _getElementsInHierarachy( transformedData.col_nodes, maxLevel );
        data.colObjects = _sortByLevelHierarachy( data.colObjects, maxLevel );
        appCtxService.registerPartialCtx( 'MatrixContext.parentCols', data.colObjects );
        _data.colObjects = data.colObjects;
        noSortCol = false;
        registerCtxIfHiddenObjPresent( data );
    }
};

/**
 * This method Attaches a method which aids sorting
 * @param {object} data - viewModel data
 *
 */

export const attachSortingHandler = function( type ) {
    if( sortOn === 'row' ) {
        rowSort = true;
        rowSortType = type;
        // Reset Individual COL SORT
        if( individualColSort ) {
            individualColSort = false;
            individualColSortType = 'NOSORT';
            evtDataIndividualColSort = null;
        }

        if( type === 'NOSORT' ) {
            rowSort = false;
            noSortRow = true;
        }
        _sortHeaderObjectsWithSortCriteria( type, 'row' );
    } else if( sortOn === 'col' ) {
        colSort = true;
        colSortType = type;
        // Reset Individual ROW SORT
        if( individualRowSort ) {
            individualRowSort = false;
            individualRowSortType = 'NOSORT';
            evtDataIndividualRowSort = null;
        }

        if( type === 'NOSORT' ) {
            colSort = false;
            noSortCol = true;
        }
        _sortHeaderObjectsWithSortCriteria( type, 'col' );
    } else if( sortOn === 'individual-row' ) {
        individualRowSort = true;
        individualRowSortType = type;
        // Reset COL SORT
        if( colSort ) {
            colSort = false;
            colSortType = 'NOSORT';
        }

        _sortCellsWithSortCriteria( sortOn, type );
    } else {
        individualColSort = true;
        individualColSortType = type;
        // Reset ROW SORT
        if( rowSort ) {
            rowSort = false;
            rowSortType = 'NOSORT';
        }

        _sortCellsWithSortCriteria( sortOn, type );
    }
    // Hide the trace matrix sorting popup after any action
    if( _popupRef ) {
        popupService.hide( _popupRef );
    }
    sortOn = '';
};
/**
 * This method invokes the sorting popup for trace mat
 * @param {object} eventData - it contains information related to the sort applied
 *
 */
export const invokeSortPopupOnTraceMat = ( eventData ) => {
    popupService.show( eventData.popupData ).then( function( popupRef ) {
        _popupRef = popupRef;
        sortOn = eventData.sortOn;
        //cache indiviual row/col sort element uid
        if( eventData.individualSort && eventData.individualSort.sortCol ) {
            evtDataIndividualRowSort = eventData.individualSort;
        }
        if( eventData.individualSort && eventData.individualSort.sortRow ) {
            evtDataIndividualColSort = eventData.individualSort;
        }
        eventBus.publish( 'Arm0TraceabilitySortPopup.reveal', {} );
    } );
};

/**
 * This method sorts the requirement elements with necessary sort criteria
 * @param {String} type - type defines sorting to be applied on what element
 * @param {String} sortType - sortType defines what kind of sorting needs to be applied
 *
 */
const _sortHeaderObjectsWithSortCriteria = ( type, sortType ) => {
    let sortedResult = {};
    if( type === 'ASC' ) {
        if( sortType === 'row' ) {
            sortedResult = sortElementsAscending( _data.rowObjects );
            applyRowGlobalSort( sortedResult );
        } else {
            sortedResult = sortElementsAscending( _data.colObjects );
            applyColGlobalSort( sortedResult );
        }
    } else if( type === 'DESC' ) {
        if( sortType === 'row' ) {
            sortedResult = sortElementsDescending( _data.rowObjects );
            applyRowGlobalSort( sortedResult );
        } else {
            sortedResult = sortElementsDescending( _data.colObjects );
            applyColGlobalSort( sortedResult );
        }
    } else {
        _resetSortCriteriaApplied();
    }
};

/**
 * This method sorts the requirement elements with element hierarchy
 * @param {Array} elements - type defines sorting to be applied on what element
 * @param {Number} maxLevel - sortType defines what kind of sorting needs to be applied
 * @return {Array} - level sorted array
 *
 */
const _getElementsInHierarachy = ( elements, maxLevel ) => {
    let clonedSortedResult = [ ...elements ];
    let level0SortedArray = _sortForLevel0( clonedSortedResult );
    for( let i = 0; i < maxLevel; i++ ) {
        for( let j = 0; j < level0SortedArray.length; j++ ) {
            if( i === level0SortedArray[ j ].level ) {
                let counterForCurrParent = 0;
                let curParentUID = level0SortedArray[ j ].uid;
                for( let k = 0; k < level0SortedArray.length; k++ ) {
                    if( curParentUID === level0SortedArray[ k ].parentUid ) {
                        let element = level0SortedArray[ k ];
                        level0SortedArray.splice( k, 1 );
                        level0SortedArray.splice( j + 1 + counterForCurrParent, 0, element );
                        counterForCurrParent++;
                    }
                }
                counterForCurrParent = 0;
            }
        }
    }
    return level0SortedArray;
};

/**
 * This method applies the sort on row elements with the required sort criteria
 * @param {Array} sortedResult - it contains the row elements which need multi level sort
 * @param {Boolean} returnData - boolean flag to break the execution of the function early
 * @return {Array} - returns the sorted result
 *
 */
const applyRowGlobalSort = ( sortedResult, returnData = false ) => {
    if( returnData ) {
        let finalRes = {};
        if( rowSortType === 'ASC' ) {
            finalRes = sortElementsAscending( sortedResult );
        } else if( rowSortType === 'DESC' ) {
            finalRes = sortElementsDescending( sortedResult );
        }
        return _sortByLevelHierarachy( finalRes.clonedElements, finalRes.maxLevel );
    }
    var sortedObj = _sortByLevelHierarachy( sortedResult.clonedElements, sortedResult.maxLevel );
    _data.rowObjects = changeIsPreviousHiddenFlag( sortedObj );

    appCtxService.registerPartialCtx( 'MatrixContext.parentRows', _data.rowObjects );
    processData( _data, appCtxService.ctx );
};

/**
 * This method applies the sort on column elements with the required sort criteria
 * @param {Array} sortedResult - it contains the column elements which need multi level sort
 * @param {Boolean} returnData - boolean flag to break the execution of the function early
 * @return {Array} - returns the sorted result
 *
 */
const applyColGlobalSort = ( sortedResult, returnData = false ) => {
    if( returnData ) {
        let finalRes = {};
        if( colSortType === 'ASC' ) {
            finalRes = sortElementsAscending( sortedResult );
        } else if( colSortType === 'DESC' ) {
            finalRes = sortElementsDescending( sortedResult );
        }
        return _sortByLevelHierarachy( finalRes.clonedElements, finalRes.maxLevel );
    }
    var sortedObj = _sortByLevelHierarachy( sortedResult.clonedElements, sortedResult.maxLevel );
    _data.colObjects = changeIsPreviousHiddenFlag( sortedObj );

    appCtxService.registerPartialCtx( 'MatrixContext.parentCols', _data.colObjects );
    processData( _data, appCtxService.ctx );
};

/**
 * This method will set isPreviousHidden flag of object next to hidden object
 *
 */
var changeIsPreviousHiddenFlag = function( sortedArray ) {
    for( var index = 0; index < sortedArray.length; index++ ) {
        //If current element is hidden then enable isPreviousHidden flag of next element
        if( sortedArray[ index ].isHidden && sortedArray[ index + 1 ] ) {
            sortedArray[ index + 1 ].isPreviousObjectHidden = true;
        }
        //If current element is not hidden then disable isPreviousHidden flag of next element
        else if( sortedArray[ index + 1 ] ) {
            sortedArray[ index + 1 ].isPreviousObjectHidden = false;
        }
        //If previous of current element is undefined or non hidden then disable isPreviousHidden of current element
        if( sortedArray[ index - 1 ] === undefined || !sortedArray[ index - 1 ].isHidden ) {
            sortedArray[ index ].isPreviousObjectHidden = false;
        }
    }
    return sortedArray;
};
/**
 * This method resets the current sort criteria state
 *
 */
const _resetSortCriteriaApplied = () => {
    sortOn = '';
    exports.refreshTraceabilityMatrix();
};

/**
 * This method sorts the elements in ascending order
 * @param {Array} elements - sorts the elements in ascending order
 * @return {Object} - returns an object which has the sorted result and the max level of the child present
 *
 */
const sortElementsAscending = elements => {
    let clonedElements = [ ...elements ];
    let maxLevel = 0;
    clonedElements.sort( ( a, b ) => {
        maxLevel = _calculuateMaxLevelHierahchy( a, b, maxLevel );
        // var nameA = !appCtxService.ctx.showObjectId ? a.name.toUpperCase() : a.id.toUpperCase();
        // var nameB = !appCtxService.ctx.showObjectId ? b.name.toUpperCase() : b.id.toUpperCase();
        var nameA = a.displayName.toUpperCase();
        var nameB = b.displayName.toUpperCase();
        //Set previous hidden flag to false as columns will be rearrange after sorting
        a.isPreviousObjectHidden = false;
        b.isPreviousObjectHidden = false;
        if( nameA < nameB ) {
            return -1;
        }
        if( nameA > nameB ) {
            return 1;
        }
        return 0;
    } );
    return {
        clonedElements,
        maxLevel
    };
};

/**
 * This method sorts the elements in descending order
 * @param {Array} elements - sorts the elements in descending order
 * @return {Object} - returns an object which has the sorted result and the max level of the child present
 *
 */
const sortElementsDescending = elements => {
    let clonedElements = [ ...elements ];
    let maxLevel = 0;
    clonedElements.sort( ( a, b ) => {
        maxLevel = _calculuateMaxLevelHierahchy( a, b, maxLevel );
        // var nameA = !appCtxService.ctx.showObjectId ? a.name.toUpperCase() : a.id.toUpperCase();
        // var nameB = !appCtxService.ctx.showObjectId ? b.name.toUpperCase() : b.id.toUpperCase();
        var nameA = a.displayName.toUpperCase();
        var nameB = b.displayName.toUpperCase();
        //Set previous hidden flag to false as columns will be rearrange after sorting
        a.isPreviousObjectHidden = false;
        b.isPreviousObjectHidden = false;
        if( nameA < nameB ) {
            return 1;
        }
        if( nameA > nameB ) {
            return -1;
        }
        return 0;
    } );
    return {
        clonedElements,
        maxLevel
    };
};

/**
 * This method sorts the elements with the hierarachy
 * @param {Array} sortedEle - elements which need to be sorted with preserving the hierarachy
 * @param {Number} maxLevel - the max level of the child wrt to hierarachy
 * @return {Array} - returns an array with appropriate hierarachy
 *
 */
const _sortByLevelHierarachy = ( sortedEle, maxLevel ) => {
    let clonedSortedResult = [ ...sortedEle ];
    let level0SortedArray = _sortForLevel0( clonedSortedResult );
    for( let i = 0; i < maxLevel; i++ ) {
        for( let j = 0; j < level0SortedArray.length; j++ ) {
            if( i === level0SortedArray[ j ].level ) {
                let counterForCurrParent = 0;
                if( level0SortedArray[ j ].isHidden === undefined || !level0SortedArray[ j ].isHidden ) {
                    let curParentUID = level0SortedArray[ j ].occurrence.uid;
                    for( let k = 0; k < level0SortedArray.length; k++ ) {
                        if( curParentUID === level0SortedArray[ k ].parentUid ) {
                            let element = level0SortedArray[ k ];
                            level0SortedArray.splice( k, 1 );
                            level0SortedArray.splice( j + 1 + counterForCurrParent, 0, element );
                            counterForCurrParent++;
                        }
                    }
                    counterForCurrParent = 0;
                }
            }
        }
    }
    return level0SortedArray;
};

/**
 * This method sorts the elements with the hierarachy but just with level 0
 * @param {Array} sortedResult - sorted elements
 * @param {Number} maxLevel - the max level of the child wrt to hierarachy
 * @return {Array} - returns an array which sorts the elements with level 0
 *
 */
const _sortForLevel0 = sortedResult => {
    let counter = 0;
    let newArray = [ ...sortedResult ];
    for( let i = 0; i < sortedResult.length; i++ ) {
        if( sortedResult[ i ].level === 0 ) {
            let element = newArray[ i ];
            newArray.splice( i, 1 );
            newArray.splice( counter, 0, element );
            counter++;
        }
    }
    return newArray;
};

/**
 * This method sorts the elements with the tracelink counts present on the cells
 *
 */
const _sortCellsWithSortCriteria = ( sortOn, type ) => {
    if( type === 'NOSORT' ) {
        if( sortOn === 'individual-row' ) {
            individualRowSort = false;
            noSortCol = true;
        } else if( sortOn === 'individual-col' ) {
            individualColSort = false;
            noSortRow = true;
        }
        _resetSortCriteriaApplied();
        return;
    }
    //fire event to show matrix with sorted data
    if( sortOn === 'individual-row' ) {
        eventBus.publish( 'Arm0TraceabilityMatrix.sortTraceabilityMatrix', evtDataIndividualRowSort );
    } else {
        eventBus.publish( 'Arm0TraceabilityMatrix.sortTraceabilityMatrix', evtDataIndividualColSort );
    }
};

/**
 * This method sorts the elements with the hierarachy for tracelink count
 * @param {Array} elements - elements which need to be sorted with preserving the hierarachy
 * @param {Number} maxLevel - the max level of the child wrt to hierarachy
 * @return {Array} - returns an array with appropriate hierarachy
 *
 */
const _globalSortForTracelinkCount = ( elements, maxLevel ) => {
    return _sortByLevelHierarachy( elements, maxLevel );
};

/**
 * This method sorts the row elements with the tracelink count
 * @param {Array} elements - elements which need to be sorted with preserving the hierarachy
 * @return {Array} - returns an array with appropriate hierarachy
 *
 */
const _sortRowObjectsWithTracelinkCount = ( elements ) => {
    if( individualColSortType === 'ASC' ) {
        return _sortRowsOnTracelinkAscending( elements );
    } else if( individualColSortType === 'DESC' ) {
        return _sortRowsOnTracelinkDescending( elements );
    }
};

/**
 * This method ascending sorts the row elements with the tracelink count
 * @param {Array} elements - elements which need to be sorted with preserving the hierarachy
 * @return {Array} - returns an array with appropriate hierarachy
 *
 */
const _sortRowsOnTracelinkAscending = elements => {
    return [ ...elements ].sort( function( a, b ) {
        var link1 = cellDataMap[ a.occurrence.uid.concat( '+' ).concat( evtDataIndividualColSort.sortRow ) ];
        var link2 = cellDataMap[ b.occurrence.uid.concat( '+' ).concat( evtDataIndividualColSort.sortRow ) ];
        return ( link1 ? link1.numOfLinksOnChildren : 0 ) - ( link2 ? link2.numOfLinksOnChildren : 0 );
    } );
};

/**
 * This method descending sorts the row elements with the tracelink count
 * @param {Array} elements - elements which need to be sorted with preserving the hierarachy
 * @return {Array} - returns an array with appropriate hierarachy
 *
 */
const _sortRowsOnTracelinkDescending = elements => {
    return [ ...elements ].sort( function( a, b ) {
        var link1 = cellDataMap[ a.occurrence.uid.concat( '+' ).concat( evtDataIndividualColSort.sortRow ) ];
        var link2 = cellDataMap[ b.occurrence.uid.concat( '+' ).concat( evtDataIndividualColSort.sortRow ) ];
        return ( link2 ? link2.numOfLinksOnChildren : 0 ) - ( link1 ? link1.numOfLinksOnChildren : 0 );
    } );
};

/**
 * This method sorts the column elements with the tracelink count
 * @param {Array} elements - elements which need to be sorted with preserving the hierarachy
 * @return {Array} - returns an array with appropriate hierarachy
 *
 */
const _sortColObjectsWithTracelinkCount = ( elements ) => {
    if( individualRowSortType === 'ASC' ) {
        return _sortColsOnTracelinkAscending( elements );
    } else if( individualRowSortType === 'DESC' ) {
        return _sortColsOnTracelinkDescending( elements );
    }
};

/**
 * This method ascending sorts the column elements with the tracelink count
 * @param {Array} elements - elements which need to be sorted with preserving the hierarachy
 * @return {Array} - returns an array with appropriate hierarachy
 *
 */
const _sortColsOnTracelinkAscending = elements => {
    return [ ...elements ].sort( function( a, b ) {
        var link1 = cellDataMap[ evtDataIndividualRowSort.sortCol.concat( '+' ).concat( a.occurrence.uid ) ];
        var link2 = cellDataMap[ evtDataIndividualRowSort.sortCol.concat( '+' ).concat( b.occurrence.uid ) ];
        return ( link1 ? link1.numOfLinksOnChildren : 0 ) - ( link2 ? link2.numOfLinksOnChildren : 0 );
    } );
};

/**
 * This method descending sorts the column elements with the tracelink count
 * @param {Array} elements - elements which need to be sorted with preserving the hierarachy
 * @return {Array} - returns an array with appropriate hierarachy
 *
 */
const _sortColsOnTracelinkDescending = elements => {
    return [ ...elements ].sort( function( a, b ) {
        var link1 = cellDataMap[ evtDataIndividualRowSort.sortCol.concat( '+' ).concat( a.occurrence.uid ) ];
        var link2 = cellDataMap[ evtDataIndividualRowSort.sortCol.concat( '+' ).concat( b.occurrence.uid ) ];
        return ( link2 ? link2.numOfLinksOnChildren : 0 ) - ( link1 ? link1.numOfLinksOnChildren : 0 );
    } );
};

/**
 * This method calculates and returns the max level of the child
 * @param {Object} a - Object a which has level property
 * @param {Object} b - Object b which has level property
 * @param {Number} maxLevel - the max level of the child
 * @return {Number} maxLevel - returns the max level of the child
 *
 */
const _calculuateMaxLevelHierahchy = ( a, b, maxLevel ) => {
    if( maxLevel < a.level ) {
        maxLevel = a.level;
    }
    if( maxLevel < b.level ) {
        maxLevel = b.level;
    }
    return maxLevel;
};

/**
 * This method resets the current local state of the sort and sort criteria
 *
 */
const _resetLocalSortData = () => {
    sortOn = '';
    evtDataIndividualRowSort = null;
    evtDataIndividualColSort = null;
    rowSort = '';
    colSort = '';
    individualRowSort = '';
    individualColSort = '';
    rowSortType = 'NOSORT';
    colSortType = 'NOSORT';
    individualRowSortType = 'NOSORT';
    individualColSortType = 'NOSORT';
};

/*
                END ==> THIS SECTION CONTAINS METHODS RELATED TO MANAGE AND HANDLE SORTING ON THE TRACEABILITY MATRIX SVG
        */

export default exports = {
    OpenCreateTracelinkPanel,
    OpenCloseCreateTracelinkPanel,
    processResponse,
    updateFileContentInFormData,
    tracelinkDeleted,
    loadFlatTableData,
    showTracelinksPopup,
    closeMatrixTablePropView,
    getLinkTypes,
    refreshTraceabilityMatrix,
    tracelinkCreated,
    updatePropertiesOnModelObjectChanged,
    captureUserSelection,
    generateTraceabilityMatrix,
    init,
    resetMatrixCommandClick,
    openReplacePanel,
    resetTraceMatrix,
    rollupClicked,
    getChildMatrixInput,
    getTraceMatrixInput,
    setPageSize,
    toggleHeatMap,
    getNoOfItemsPerPage,
    isNavigationRequired,
    isSoapaginationRequired,
    getSelectedTypeOfTraceLink,
    performPagination,
    refreshTracelinkMatrixObject,
    updateMatrixAsSaved,
    showUpdatedTLMatrix,
    loadTMOproperties,
    buildInputForSaveEditingTMO,
    getTraceMatrixInputForSave,
    getFileUrl,
    collapseNode,
    openArm0TraceabilityMatrixSettings,
    tracelinkDirectionChangeAction,
    updateValues,
    showEmptyRowsAndColsAction,
    sortTraceabilityMatrix,
    applyMatrixSettings,
    setServiceData,
    processDataFromServer,
    destroyTraceabilityMatrix,
    getInputDeleteTraceLinkInTM,
    showDeleteTracelinkTMWarning,
    callHideRow,
    hideRowOrColumn,
    createPopupData,
    createFacetProp,
    UnhideAllFromSelected,
    unhideAll,
    callUnhideAll,
    unhideSelected,
    updateSelectAllProp,
    updateColumnValuesProp,
    filterFacetInputChanged,
    filterAction,
    performExpandBelow,
    performCollapseBelow,
    attachSortingHandler,
    invokeSortPopupOnTraceMat,
    getSettingProperties,
    getSettingPropertiesToBeShown,
    getTraceMatrixFilterInput,
    applyFilterToTM,
    resizeWindow,
    postTracelinkDeletion,
    populateFilterInformation,
    loadObjects,
    isReviseOperation
};
