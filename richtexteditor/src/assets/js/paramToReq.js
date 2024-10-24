// Copyright (c) 2022 Siemens

/**
 * @module js/paramToReq
 */
import appCtxService from 'js/appCtxService';
import cmdMapSvc from 'js/commandsMapService';
import cmdPanelSvc from 'js/commandPanel.service';
import eventBus from 'js/eventBus';
import reqUtils from 'js/requirementsUtils';
import cdm from 'soa/kernel/clientDataModel';
import ckeditorOperations from 'js/ckeditorOperations';

import _ from 'lodash';

var exports = {};


var _parameterTablePropertiesLoaded = null;
var _changeRowSelection = null;

var _parameterCreated;
var _parameterUpdated;

/**
 * Evaluates if a measurable attribute has been created and publishes an event to refresh
 * the UI if so.
 *
 * @param {Object} eventMap the event map
 */
export let isParamCreated = function( parameter ) {
    if( parameter ) {
        var objects;
        if( parameter.createdObjects ) {
            objects = parameter.createdObjects;
        }else if( parameter.updatedObjects ) {
            objects = parameter.updatedObjects;
        }

        if( objects ) {
            var eventData = {
                createdParameterd: ''
            };
            var outputData = {};
            var parameters = [];
            if( _areAnyCreatedObjsAttrType( objects, outputData ) ) {
                if( outputData.measurableAtributes.length > 0 ) {
                    for ( var i = 0; i < outputData.measurableAtributes.length; i++ ) {
                        parameters.push( outputData.measurableAtributes[i].uid );
                    }
                }
                if( outputData.relationObjects.length > 0 ) {
                    var cellProp = [ 'secondary_object' ];
                    var obj = outputData.relationObjects;
                    reqUtils.loadModelObjects( obj, cellProp ).then( function() {
                        for ( var i = 0; i < outputData.relationObjects.length; i++ ) {
                            var attribute = cdm.getObject( outputData.relationObjects[i].uid );
                            var attributeUid = attribute.props.secondary_object.dbValues[0];
                            parameters.push( attributeUid );
                        }
                        eventData.createdParameterd = parameters.join();
                        eventBus.publish( 'requirementDocumentation.parameterCreated', eventData );
                    } );
                } else {
                    eventData.createdParameterd = parameters.join();
                    eventBus.publish( 'requirementDocumentation.parameterCreated', eventData );
                }
            }
        }
    }
};

export let unsubscribeCreatedAndUpdatedEvent = function() {
    if( _parameterCreated || _parameterUpdated ) {
        eventBus.unsubscribe( _parameterCreated );
        eventBus.unsubscribe( _parameterUpdated );
        _parameterCreated = undefined;
        _parameterUpdated = undefined;
    }
};

/**
 * @param {Array} createdObjects the created objects
 * @returns {boolean} true if any created objects are measurable attributes
 */
export let subscribeParameterCreatedevent = function( ) {
    unsubscribeCreatedAndUpdatedEvent();
    _parameterCreated = eventBus.subscribe( 'cdm.created', function( eventData ) {
        unsubscribeCreatedAndUpdatedEvent();
        isParamCreated( eventData );
    }  );

    _parameterUpdated = eventBus.subscribe( 'cdm.updated', function( eventData ) {
        unsubscribeCreatedAndUpdatedEvent();
        isParamCreated( eventData );
    }  );
};

/**
 * @param {Array} createdObjects the created objects
 * @returns {boolean} true if any created objects are measurable attributes
 */
function _areAnyCreatedObjsAttrType( createdObjects, outputData ) {
    var isParameterCreated = false;
    if( createdObjects ) {
        outputData.relationObjects = [];
        outputData.measurableAtributes = [];
        for( var j = 0; j < createdObjects.length; ++j ) {
            if( cmdMapSvc.isInstanceOf( 'Att0MeasurableAttribute', createdObjects[ j ].modelType ) ) {
                outputData.measurableAtributes.push( createdObjects[ j ] );
                isParameterCreated = true;
            } else if( cmdMapSvc.isInstanceOf( 'Att0AttrRelation', createdObjects[ j ].modelType ) ) {
                outputData.relationObjects.push( createdObjects[ j ] );
                isParameterCreated = true;
            }else if( cmdMapSvc.isInstanceOf( 'Att0HasParamValue', createdObjects[ j ].modelType ) ) {
                outputData.relationObjects.push( createdObjects[ j ] );
                isParameterCreated = true;
            }
        }
    }
    return isParameterCreated;
}
/**
 *Change row selection after properties loaded
 * @param {Object} eventData the event data
 */
export let setRowSelectionAfterPropertiesLoaded = function( eventData ) {
    var selectionData = eventData.data.eventMap['requirementDocumentation.changeSelection'];
    if( selectionData ) {
        var eventData1 = {
            paramid: selectionData.paramid
        };

        eventBus.publish( 'arm0MappedAttrTreeTable.changeRowSelection', eventData1 );
    }
};

export let updateReferenceForAddPanel = function( popupAction ) {
    ckeditorOperations.setEditorSelection();
    let newRef = ckeditorOperations.getEditorSelection();
    popupAction.update( { reference: newRef } );
};

export let removeEditorSelection = function() {
    ckeditorOperations.removeEditorSelection();
};

export let setEditorSelection = function( ) {
    ckeditorOperations.setEditorSelection();
};

function nthIndex( str, pat, n ) {
    var L = str.length; var  i = -1;

    while( n-- && i++ < L ) {
        i = str.indexOf( pat, i );
        if ( i < 0 ) {
            break;
        }
    }
    return i;
}

/**
 * Method to update editor state as per the param selections in the parameter table
 * @param {*} eventData
 */
export let handleParameterSelectionChange = function( eventData ) {
    let paramSourceId = eventData.selectedProxyParams[ 0 ].uid;
    let startIndex = nthIndex( paramSourceId, 'SR::N::', 2 );
    let endIndex = nthIndex( paramSourceId, 'AWBCB', 1 );
    let result = paramSourceId.substring( startIndex, endIndex + 5 );

    let selectedReqElement = document.getElementById( result );

    const element = selectedReqElement.querySelectorAll( 'a' );
    if( element && element.length > 0 && selectedReqElement ) {
        element.forEach( ( userItem ) => {
            let id = userItem.getAttribute( 'paramid' );
            if( id && id === eventData.selectedParams[ 0 ].uid ) {
                let selectedParamElement = selectedReqElement.querySelector( '[paramid="' + eventData.selectedParams[ 0 ].uid + '"]' );
                if( selectedParamElement ) {
                    selectedParamElement.scrollIntoView();
                } else {
                    selectedReqElement.scrollIntoView();
                }
            } else {
                selectedReqElement.scrollIntoView();
            }
        } );
    } else {
        if( selectedReqElement ) {
            selectedReqElement.scrollIntoView();
        }
    }
};

/**
 *Change row selection when clicked on text linked to parameter and table exist
 * @param {Object} eventData the event data
 */
export let changeRowSelectionWhenTableExist = function( eventData ) {
    var eventData1 = {
        paramid: eventData.data.paramid
    };
    eventBus.publish( 'arm0MappedAttrTreeTable.changeRowSelection', eventData1 );
};
/**
 *Set row selection on data provider of attribute table
 *
 * @param {Object} eventData the event data
 */
export let setRowSelection = function( eventData ) {
    var dataProvider = eventData.data.dataProviders.gridDataProvider;
    var selModel = dataProvider.selectionModel;
    var vmObjects = dataProvider.viewModelCollection.loadedVMObjects;
    var paramid = eventData.data.eventData.paramid;
    var objToSelect;
    for( var object in vmObjects ) {
        if( vmObjects[ object ].props && vmObjects[ object ].props.att1SourceAttribute.dbValue === paramid ) {
            objToSelect = vmObjects[ object ];
            break;
        }
    }
    if( objToSelect ) {
        selModel.setSelection( objToSelect );
    }
    eventBus.publish( 'requirementDocumentation.attrTableRowSelected' );
};

export let tableDataLoaded = function() {
    if( appCtxService.ctx.isRefreshRequired ) {
        appCtxService.ctx.isRefreshRequired = undefined;
        var objectToFetchParameters = appCtxService.ctx.requirementCtx.objectsToSelect;
        var mappingCtx = appCtxService.ctx.Att1ShowMappedAttribute;
        var objectForWhichParametersFetched = mappingCtx.parentUids;
        if( objectToFetchParameters !== objectForWhichParametersFetched ) {
            var selected = cdm.getObject( objectToFetchParameters );
            var selectedObjs = [ selected ];
            var cachedEventData = {
                selections : selectedObjs
            };
            eventBus.publish( 'RequirementsManagement.SelectionChangedInDocumentationTab', cachedEventData );
        }
    }
};

export let changePanelLocation = function( panelLocation, requirementCtx ) {
    var newRequirementCtx = { ...requirementCtx.getValue() };
    newRequirementCtx.splitPanelLocation = panelLocation;
    requirementCtx.update( newRequirementCtx );
    // Event to resize Ckeditor
    eventBus.publish( 'requirementsEditor.resizeEditor' );
};

/**
 *Check parameter table is currently displayed or not
 * @param {Object} data the event data
 */
export let checkParamTable = function( data, subpanelContext, requirementsCtx ) {
    var eventData = {
        paramid: data.paramid,
        objectsToSelect:data.objectsToSelect
    };
    var selected = cdm.getObject( data.objectsToSelect );
    _.set( appCtxService, 'ctx.requirements.selectedObjects', [ selected ] );
    appCtxService.ctx.isRefreshRequired = true;
    exports.changePanelLocation( 'bottom', requirementsCtx );
    var mappingCtx = appCtxService.ctx.Att1ShowMappedAttribute;
    if( mappingCtx ) {
        var objectForWhichParametersFetched = mappingCtx.parentUids;
        if( data.objectsToSelect && data.objectsToSelect !== objectForWhichParametersFetched ) {
            var selectedObjs = [ selected ];
            var cachedEventData = {
                selections : selectedObjs
            };
            appCtxService.ctx.requirementCtx.objectsToSelect = data.objectsToSelect;
            appCtxService.ctx.isSectionChangedInPWA = false;
            eventBus.publish( 'Arm0RequirementParameterTable.selectionChangeEvent', cachedEventData );
            eventBus.publish( 'requirementDocumentation.changeSelection', eventData );
        } else{
            eventBus.publish( 'requirementDocumentation.changeSelection', eventData );
        }
    }
    // UniformTable events
    var paramIds = eventData.paramid.split( ',' );
    var paramsToselect = [];
    for( var i = 0; i < paramIds.length; i++ ) {
        paramsToselect.push( { uid:paramIds[i] } );
    }

    if( subpanelContext && subpanelContext.selection && subpanelContext.selection.length > 0 ) {
        var selectNodeEventData = { attributesToSelect:paramsToselect };
        var selectedParentUid = subpanelContext.selection[0].uid;
        if( data.objectsToSelect && data.objectsToSelect !== selectedParentUid ) {
            var selectedObj = cdm.getObject( data.objectsToSelect );
            var syncTableEventData = {
                selectedParents : [ selectedObj ]
            };
            eventBus.publish( 'uniformParamTable.applySync', syncTableEventData );
        } else{
            eventBus.publish( 'uniformParamTable.selectNodes', selectNodeEventData );
        }
    }

    eventBus.subscribe( 'uniformParamTable.tableLoaded', function() {
        if( subpanelContext.context.occContext.tabNameToActivate === 'tc_xrt_Documentation' ) {
            var selectNodeEventData = { attributesToSelect: paramsToselect };
            eventBus.publish( 'uniformParamTable.selectNodes', selectNodeEventData );
        }
        eventBus.unsubscribe( 'uniformParamTable.tableLoaded' );
    } );
};
/**
 *Clear flag on row selection complete
 * @param {Object} data the event data
 */
export let rowSelectionComplete = function( data ) {
    if( data.selectParam ) {
        data.selectParam = null;
    }
};
/**
 *Fire event on properties loaded
 */
export let onPropertiesLoaded = function() {
    eventBus.publish( 'Arm0AttrTable.propertiesLoaded' );
};
export let changeTabSelection = function() {
    var tab = {
        tabKey: 'search'
    };
    eventBus.publish( 'awTab.setSelected', tab );
};
/**
 *Subscribe event on parameter table properties loaded
 */
export let parameterTableContentloaded = function() {
    _parameterTablePropertiesLoaded = eventBus.subscribe( 'Att1AttrMappingTable.propertiesLoaded', function() {
        exports.onPropertiesLoaded();
        exports.tableDataLoaded();
    }, 'paramToReq' );
    _changeRowSelection = eventBus.subscribe( 'arm0ChangeAttrTableRowSelection', function( eventData ) {
        exports.setRowSelection( eventData );
    }, 'paramToReq' );

    // Event to resize Ckeditor
    eventBus.publish( 'requirementsEditor.resizeEditor' );
};
/**
 *unsubscribe event on parameter table properties loaded
 */
export let parameterTableContentUnloaded = function() {
    if( _parameterTablePropertiesLoaded ) {
        eventBus.unsubscribe( 'Att1AttrMappingTable.propertiesLoaded' );
    }

    if( _changeRowSelection ) {
        eventBus.unsubscribe( 'arm0ChangeAttrTableRowSelection' );
    }

    // Event to resize Ckeditor
    eventBus.publish( 'requirementsEditor.resizeEditor' );
};

export let activateAddParameterCommandPanel = function( context ) {
    context.selectTab =  'search';
    appCtxService.ctx.ignoreAttachParamPartialError = true;
    cmdPanelSvc.activateCommandPanel( 'Att1AddParameterPanel', 'aw_toolsAndInfo', context );
    var _eventSubAddParameterPanel = eventBus.subscribe( 'awPanel.reveal', function( eventData ) {
        if( eventData.panelId === 'Att1AddParameterPanelSub' ) {
            setTimeout( function() {
                exports.changeTabSelection();
            }, 500 );
        }
        eventBus.unsubscribe( _eventSubAddParameterPanel );
    } );

    var addParameterFailure = eventBus.subscribe( 'AttachParameter.AttachParameterFailure', function( failureData, selectedParameters ) {
        setTimeout( function() {
            var selectedAttrs =  failureData.selectedParameterUid;
            selectedAttrs = selectedAttrs.map( function( elem ) {
                return elem.uid;
            } ).join();
            for( var i = 0; i < failureData.errorCode.length; i++ ) {
                if( failureData.errorCode[i].errorValues[0].code === 515106 || failureData.errorCode[i].errorValues[0].code === 185041 || failureData.errorCode[i].errorValues[0].code === 185433 ) {
                    var eventData = {
                        createdParameterd:selectedAttrs
                    };
                    eventBus.publish( 'requirementDocumentation.parameterCreated', eventData );
                    appCtxService.ctx.ignoreAttachParamPartialError = undefined;
                }
            }
        }, 500 );
        eventBus.unsubscribe( addParameterFailure );
    } );

    var _sideNavEventSub = eventBus.subscribe( 'awsidenav.openClose', function( eventData ) {
        if( eventData && eventData.id === 'aw_toolsAndInfo' && eventData.commandId === 'Att1AddParameterPanel' && !appCtxService.ctx.activeToolsAndInfoCommand && !eventData.includeView ) {
            appCtxService.ctx.ignoreAttachParamPartialError = undefined;
            eventBus.unsubscribe( _sideNavEventSub );
        }
    } );
};

export default exports = {
    isParamCreated,
    setRowSelectionAfterPropertiesLoaded,
    changeRowSelectionWhenTableExist,
    setRowSelection,
    checkParamTable,
    rowSelectionComplete,
    onPropertiesLoaded,
    changeTabSelection,
    parameterTableContentloaded,
    parameterTableContentUnloaded,
    activateAddParameterCommandPanel,
    tableDataLoaded,
    changePanelLocation,
    setEditorSelection,
    removeEditorSelection,
    updateReferenceForAddPanel,
    handleParameterSelectionChange,
    subscribeParameterCreatedevent,
    unsubscribeCreatedAndUpdatedEvent
};
