// Copyright (c) 2022 Siemens

/**
 * Service while will allow users to select the file and upload to FMS
 * @module js/Att1ParameterWidePanelService
 */
import eventBus from 'js/eventBus';
import fileSelectionService from 'js/Att1FileSelectionService';
import complexDataSerice from 'js/Att1ComplexDataService';
import { popupService } from 'js/popupService';
import { DOMAPIs as dom } from 'js/domUtils';
import popupUtils from 'js/popupUtils';
import appCtxSvc from 'js/appCtxService';
import engrTableService from 'js/Att1EngrTableService';
import cdm from 'soa/kernel/clientDataModel';
import $ from 'jquery';
import parameterMgmtUtil from 'js/Att1ParameterMgmtUtilService';
import _ from 'lodash';

var _PopupRef;
var _loadingWidePopup = false;
let subscriptions = [];
var isShowMeasurementTab = false;
var exports = {};

/**
 * Show popup
 * @param {Object} popupData - data to open popup panel
 * @param {Boolean} calcHeight - Boolean for cheking if height calculation required or not
 */
export let showParameterData = function( options, popupAction ) {
    let { data, calcHeight, parametersTable } = options;
    let _popupAction = popupAction;
    if( _loadingWidePopup && _PopupRef && _PopupRef.panelEl ) {
        // Don't process the call if panel loading is in process Or panel is initiated but context is not yet updated
        return;
    }
    if( !_PopupRef || !_PopupRef.panelEl ) {
        _loadingWidePopup = true;
        var ctx = appCtxSvc.ctx;
        if( ctx.locationContext && ctx.locationContext[ 'ActiveWorkspace:Location' ] === 'parameterComapreTaskRoot' ) {
            options.reference = '#aw_toolsAndInfo';
        }
        // Calculate the popup panel height & width based on browser size.
        if( calcHeight ) {
            var scaleObj = reCalcPanelHeightWidth();
            options.height = scaleObj.popupHeight;
            options.width = scaleObj.popupWidth;
        }
        _popupAction.show( options ).then( popupRef => {
            if( data.eventMap && data.eventMap[ 'uniformParamTable.openParameterWidePanel' ] ) {
                isShowMeasurementTab = data.eventMap[ 'uniformParamTable.openParameterWidePanel' ].isShowMeasurementTab;
            }
            _PopupRef = popupRef;
            _loadingWidePopup = false;
            subscriptions.push( eventBus.subscribe( 'LOCATION_CHANGE_COMPLETE', hidePopupPanel ) );
            var sideNavEventSub = eventBus.subscribe( 'awsidenav.openClose', function( eventData ) {
                if( eventData && eventData.id === 'aw_toolsAndInfo' ) {
                    //hidePopupPanel();
                    setTimeout( function() {
                        exports.updatePopupPosition();
                    }, 300 );
                }
            } );
            subscriptions.push( sideNavEventSub );
        } );
    }
};

/**
 * Method to update the parameter table when measurement is newly creted from wide panel
 */
export let updateMeasurementsIfUpdated = function( parametersTable ) {
    if( parametersTable && parametersTable.selectedObjects ) {
        var selected = parametersTable.selectedObjects[ 0 ];
        var propName = 'intermediateObjectUids';
        var measureValueProp = parametersTable.selectedObjects[ 0 ].props[ 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value' ];
        if( measureValueProp ) {
            var parameterUid = selected.props.att1SourceAttribute.dbValue;
            var parameterObject = cdm.getObject( parameterUid );
            if( parameterObject.props ) {
                var measureValue = parameterObject.props.att0CurrentValue.dbValues[ 0 ];
                var measureValueObject = cdm.getObject( measureValue );
                if( measureValueObject && measureValueObject.props && measureValueObject.props.att0Value ) {
                    var uiValue = '';
                    uiValue = measureValueObject.props.att0Value.uiValues[ 0 ];
                    measureValueProp.displayValues = [ uiValue ];
                    measureValueProp.uiValues = [ uiValue ];
                    measureValueProp.uiValue = uiValue;
                }
                measureValueProp[ propName ] = [ parameterUid, measureValue ];
            }
        }
    }
    eventBus.publish( 'uniformParamTable.refreshTable' );
};
export let updatePopupPositionOnOpenPanel = function() {
    var ref = '.sw-right-dialog .sw-popup-layout';
    var referenceEl = popupUtils.getElement( popupUtils.extendSelector( ref ) );
    if( !referenceEl ) {
        return;
    }
    if( referenceEl.offsetHeight <= 0 ) {
        ref = '.aw-layout-infoCommandbar';
        referenceEl = popupUtils.getElement( popupUtils.extendSelector( '.aw-layout-infoCommandbar' ) );
    }
    if( _PopupRef && referenceEl ) {
        var options = _PopupRef.options;
        if( options ) {
            options.userOptions.reference = ref;
            options.reference = referenceEl;
            popupService.update( _PopupRef );
        }
    }
};

export let updatePopupPositionOnClosePanel = function() {
    if( _PopupRef ) {
        let ref = '#aw_toolsAndInfo';
        // if ( !checkElement( ref ) ) {
        //     ref = '.aw-layout-infoCommandbar';
        // }
        let referenceEl = dom.get( ref );
        if ( referenceEl ) {
            var options = _PopupRef.options;
            options.userOptions.reference = ref;
            options.reference = referenceEl;
            options.disableUpdate = false;
            popupService.update( _PopupRef );
        }
    }
};

const checkElement = ( selector )=> {
    let el = dom.get( selector );
    if ( el && el.offsetHeight > 0 && el.offsetWidth > 0 ) {
        return true;
    }
    return false;
};

/**
 * Update Popup position
 */
export let updatePopupPosition = function() {
    var ref = '#aw_toolsAndInfo';
    var referenceEl = popupUtils.getElement( popupUtils.extendSelector( ref ) );
    if( !referenceEl ) {
        return;
    }
    if( referenceEl.offsetHeight <= 0 ) {
        ref = '.aw-layout-infoCommandbar';
        referenceEl = popupUtils.getElement( popupUtils.extendSelector( '.aw-layout-infoCommandbar' ) );
    }
    if( referenceEl ) {
        var options = _PopupRef.options;
        options.userOptions.reference = ref;
        options.reference = referenceEl;
        popupService.update( _PopupRef );
    }
};

/**
 * Update Popup position
 */
export let applyFullScreenToWidePanel = function( isFullScreen ) {
    var _isFullScreen = Boolean( isFullScreen );
    if( _PopupRef && _PopupRef.panelEl ) {
        var el = dom.get( 'div.sw-popup-contentContainer', _PopupRef.panelEl );
        if( !_isFullScreen ) {
            _isFullScreen = true;
            appCtxSvc.registerCtx( 'isParametersWidePanelInFullScreen', true );
            var width = document.getElementsByTagName( 'body' )[ 0 ].clientWidth;
            var referenceEl = $( '[anchor=aw_rightWall]' );
            if( referenceEl && referenceEl.length > 0 ) {
                var widthToSubstract = referenceEl[ 0 ].clientWidth + 10;
                width -= widthToSubstract;
            }
            el.style.width = width + 'px';
            el.style.height = document.getElementsByTagName( 'body' )[ 0 ].clientHeight - 30 + 'px';
            var size = engrTableService.getViewerHeight();
            updatePopupPosition();
            eventBus.publish( 'engrTable.renderTable', size );
        } else {
            _isFullScreen = undefined;
            appCtxSvc.registerCtx( 'isParametersWidePanelInFullScreen', undefined );
            var dimensions = reCalcPanelHeightWidth();
            el.style.width = dimensions.popupWidth;
            el.style.height = dimensions.popupHeight;
            updatePopupPosition();
        }
    }
};

/**
 * Hide the opened popup panel and remove all event subscriptions as well.
 */
export let hidePopupPanel = function( parametersTable ) {
    if( _PopupRef && _PopupRef.options ) {
        _PopupRef.options.disableClose = false;
        if( parametersTable && parametersTable.value ) {
            let parametersTableCtx = { ...parametersTable.value };
            parametersTableCtx.isComplexParameterWidePanelOpen = undefined;
            parametersTableCtx.isFileSelectedByUser = undefined;
            parametersTableCtx.addNewTableValueCommandClicked = undefined;
            parametersTableCtx.manageMeasurementsCommandClicked = undefined;
            parametersTableCtx.isPopupInFullScreenMode = undefined;
            parametersTableCtx.isParameterWidePanelOpen = undefined;
            parametersTableCtx.isPanelClosed = undefined;
            parametersTableCtx.isPanelOpened = undefined;
            parametersTableCtx.isComplexDataImportInProgress = undefined;
            parametersTableCtx.plotChartCommandClicked = undefined;
            parametersTable.update( parametersTableCtx );
        }

        popupService.hide( _PopupRef );
        for( const s of subscriptions ) {
            eventBus.unsubscribe( s );
        }
        subscriptions = [];
        _PopupRef = null;
        appCtxSvc.unRegisterCtx( 'isParametersWidePanelInFullScreen' );
    }
};

/**
 * Method to add the table in Values view for given dimension
 * @param {Object} data the view model data object
 */
export let createTableWithDimension = function( data, engrTable ) {
    let engrTableCtx = { ...engrTable.value };
    var rows = parseInt( data.NoOfRows.dbValue );
    var cols = parseInt( data.NoOfCols.dbValue );
    data.columns = {};
    data.rows = {};
    data.columns.dbValue = cols;
    data.rows.dbValue = rows;
    var copyData = {
        selectedParameter : data.subPanelContext.parametersTable.getValue().selectedUnderlyingObjects[0]
    };
    engrTableService.createGrid( cols, rows, copyData );
    var jsonString = engrTableService.createJson( false );
    engrTableCtx.goalTable = {
        tableName: jsonString
    };
    var eventData = {
        tableName: jsonString
    };

    eventBus.publish( 'Att1ParameterWidePanel.updateEngrContext', eventData );
    eventBus.publish( 'Att1ParameterWidePanel.setAttributeComplexDataSOACall', {
        jsonToUpdate: jsonString,
        row: rows,
        col: cols
    } );
    engrTable.update( engrTableCtx );
};

/**
 * resize popup after window resize
 *
 * @returns {Object} popup height & width value
 */
function reCalcPanelHeightWidth() {
    var popupHeight = 800;
    var popupWidth = 800;
    // Get the popup panel hright based on aw_toolsAndInfo div present in DOM as normal
    // commands panel will also have the similar height.
    var toolInfoElement = $( '#aw_toolsAndInfo' );
    if( toolInfoElement && toolInfoElement.parent() && toolInfoElement.parent().height() ) {
        popupHeight = toolInfoElement.parent().height();
        popupWidth = toolInfoElement.parent().width();
    }

    // If height is not valid then use hard coded height.
    if( !popupHeight || popupHeight <= 0 ) {
        popupHeight = 800;
    }
    // If width is not valid then use hard coded width.
    if( !popupWidth || popupWidth <= 0 ) {
        popupWidth = 800;
    } else {
        popupWidth -= 0.5 * popupWidth;
    }
    popupHeight += 'px';
    popupWidth += 'px';
    return { popupHeight: popupHeight, popupWidth: popupWidth };
}

/**
 * popup open hook
 */
export let handleOpenWidePanelHook = function( parametersTable ) {
    callEventAfterTimeout( 'Att1ParameterWidePanel.revealPopup', { parametersTable: parametersTable } );
};

/**
 * Method to call soa if import command in click on popup reveal
 * @param {Object} data the view model object data
 * @param {Object} parametersTable object
 */
export let revealPopup = function( data, parametersTable ) {
    var importInProgressMessage = {};
    var isComplexDataImportInProgress;
    var parameterSelectionData = {
        selectedParameter: []
    };
    parameterSelectionData.selectedParameter.push( parametersTable.selectedUnderlyingObjects[ 0 ] );
    let parametersTableCtx = { ...parametersTable.value };
    if( parametersTableCtx.isComplexDataImportInProgress && parametersTableCtx.isFileSelectedByUser ) {
        var importMessage = data.i18n.importInProgressMsg.replace( '{0}', fileSelectionService.getFileName() );
        importInProgressMessage.dispValue = importMessage;
        importInProgressMessage.displayName = importMessage;
        importInProgressMessage.uiValue = importMessage;
        isComplexDataImportInProgress = true;

        callEventAfterTimeout( 'Att1ParameterWidePanel.importComplexDataSOACall' );
    } else if( parametersTableCtx.addNewTableValueCommandClicked ) {
        callEventAfterTimeout( 'Att1ParameterWidePanel.openDimensionsPopup' );
    } else if( isShowMeasurementTab || parametersTableCtx.manageMeasurementsCommandClicked || parametersTableCtx.plotChartCommandClicked ) {
        if( parametersTableCtx.isComplexDataImportInProgress && !parametersTableCtx.isFileSelectedByUser ) {
            doPostProcessing( data );
        }
        var eventData = {
            panelId: 'Att1Measurements'
        };
        isShowMeasurementTab = false;
        callEventAfterTimeout( 'awTab.setSelected', eventData );
    } else if( parametersTableCtx.isComplexDataImportInProgress && !parametersTableCtx.isFileSelectedByUser ) {
        doPostProcessing( data );
    }
    return {
        isComplexDataImportInProgress: isComplexDataImportInProgress,
        importInProgressMessage: importInProgressMessage,
        parameterSelectionData: parameterSelectionData
    };
};

/**
 * Method to call the event with 500ms timeout
 * @param {String } eventName the event to be called
 * @param {Object} eventData the event data to be passed
 */
function callEventAfterTimeout( eventName, eventData ) {
    setTimeout( () => {
        if( eventData ) {
            eventBus.publish( eventName, eventData );
        } else {
            eventBus.publish( eventName );
        }
    }, 500 );
}

/**
 * Method to do the post processing required after SOA call
 * @param {Object} data the view model object
 */
export let doPostProcessing = function( data, parametersTable ) {
    let parametersTableCtx = { ...parametersTable.value };
    fileSelectionService.clearFileData();
    parametersTableCtx.isComplexDataImportInProgress = undefined;
    parametersTableCtx.isFileSelectedByUser = undefined;
    parametersTableCtx.manageMeasurementsCommandClicked = undefined;
    parametersTableCtx.addNewTableValueCommandClicked = undefined;
    parametersTableCtx.plotChartCommandClicked = undefined;
    parametersTable.update( parametersTableCtx );
    return { isComplexDataImportInProgress: false };
};

/**
 * Method to get the soa input required for updateParameters2 to create/update the complex data
 * @param {Objecr} parametersTable object
 * @param {Object} data the view model object data
 * @returns {Array} input required for soa call
 */
export let getSetAttributeComplexDataInput = function( parametersTable, data ) {
    var inputs = [];
    if( parametersTable && parametersTable.selectedUnderlyingObjects ) {
        var selected = parametersTable.selectedUnderlyingObjects[ 0 ];
        data.fmsTicket = fileSelectionService.getFileTicket();
        var eventMap = data.eventMap[ 'Att1ParameterWidePanel.setAttributeComplexDataSOACall' ];
        var input = {
            clientId: 'AWClient',
            parameters: [ {
                clientId: 'String',
                parameter: selected,
                goalTableInput: {},
                valueInputs: []
            } ]
        };
        if( eventMap && eventMap.jsonToUpdate ) {
            if( eventMap.row ) {
                data.NoOfRows = eventMap.row;
                data.NoOfCols = eventMap.col;
            }
            var goalTableInput = {
                operation: 'Create',
                fileTicket: data.fmsTicket,
                jsonString: eventMap.jsonToUpdate
            };
            input.parameters[ 0 ].goalTableInput = goalTableInput;
        }

        var parentObj = parameterMgmtUtil.getParentObjectForParameters();
        if( parentObj ) {
            input.parent = parentObj;
        }
        inputs.push( input );
    }
    return inputs;
};

/**
 * Method to get the soa input required for ImportParameterExcel to complex data.
 * @param {Objecr} parametersTable object
 * @param {Object} data the view model object data
 * @returns {Array} input required for soa call
 */
export let getImportComplexDataInput = function( parametersTable, data ) {
    var inputs = [];
    if( parametersTable && parametersTable.selectedUnderlyingObjects ) {
        var selected = parametersTable.selectedUnderlyingObjects[ 0 ];
        data.fmsTicket = fileSelectionService.getFileTicket();
        var input = {
            clientId: 'AWClient',
            selectedObject: selected,
            importFileFmsTicket: data.fmsTicket
        };
        inputs.push( input );
    }
    return inputs;
};

/**
 * Method to handle the parameter selection change event
 * @param {Object} data the view model service
 */
export let handleParameterSelectionChange = function( parametersTable, data ) {
    updateParameterName( data.eventData.selectedParams );
    var parameterSelectionData = _.cloneDeep( data.parameterSelectionData );
    parameterSelectionData.selectedParameter = data.eventData.selectedParams;
    callEventAfterTimeout( 'Att1EngrTable.updateTabData', { selectedParameter: data.eventData.selectedParams } );
    return {
        parameterSelectionData: parameterSelectionData
    };
};

/**
 * Method to update the wide panel header with selected parameter
 */
function updateParameterName( selectedParameters ) {
    if( _PopupRef ) {
        var popupEle = _PopupRef.panelEl;
        if( popupEle ) {
            var panelTitleContainer = popupEle.querySelector( 'div.aw-layout-panelTitle' );
            var labels = panelTitleContainer.getElementsByTagName( 'label' );
            if( labels && labels.length > 0 && selectedParameters && selectedParameters.length > 0 ) {
                var objectName = selectedParameters[ 0 ].props.object_name.uiValues[ 0 ];
                labels[ 0 ].innerText = objectName;
            }
        }
    }
}

export let updateClientWithComplexData = function( engrTable, parametersTable ) {
    var parameterSelectionData = {
        selectedParameter: []
    };

    parametersTable.addNewTableValueCommandClicked = false;
    parameterSelectionData.selectedParameter.push( parametersTable.selectedUnderlyingObjects[ 0 ] );
    eventBus.publish( 'engrTable.refresh', complexDataSerice.getDataForEngrTable( engrTable, 'goalTable' ) );
    return {
        parameterSelectionData: parameterSelectionData,
        parametersTable: parametersTable,
        engrTable:engrTable
    };
};

export let refresfClientWithImportedData = function( subPanelContext ) {
    engrTableService.getParameterComplexData( subPanelContext, undefined, true );
};

export default exports = {
    showParameterData,
    applyFullScreenToWidePanel,
    hidePopupPanel,
    handleOpenWidePanelHook,
    revealPopup,
    getSetAttributeComplexDataInput,
    getImportComplexDataInput,
    doPostProcessing,
    createTableWithDimension,
    handleParameterSelectionChange,
    updatePopupPosition,
    updatePopupPositionOnOpenPanel,
    updatePopupPositionOnClosePanel,
    updateMeasurementsIfUpdated,
    updateClientWithComplexData,
    refresfClientWithImportedData
};
