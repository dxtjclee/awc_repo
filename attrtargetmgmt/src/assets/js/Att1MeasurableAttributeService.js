// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Att1MeasurableAttributeService
 */
import appCtxSvc from 'js/appCtxService';
import cmdMapSvc from 'js/commandsMapService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dmSvc from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import logger from 'js/logger';

var exports = {};

/**
 * Checks if refresh required with given input data.
 * @param {object} isAbsOccDataUpdated - OccData
 * @param {object} isAttrUpdated - updated attribute
 * @param {object} isProxyUpdated - updated measure value
 * @param {object} isValueUpdated - updated measure value
 * @param {object} newAttrUid - new attribute uid
 * @param {object} doRefresh - true if refresh required
 * @return doRefresh
 */
function _isDataUpdated( isAbsOccDataUpdated, isAttrUpdated, isContextUpdated, isValueUpdated, newAttrUid, doRefresh ) {
    doRefresh = isAbsOccDataUpdated && isAttrUpdated;
    if( !doRefresh ) {
        doRefresh = isAttrUpdated && isContextUpdated;
        if( !doRefresh ) {
            doRefresh = isValueUpdated && isContextUpdated && newAttrUid !== null;
        }
    }
    return doRefresh;
}

/**
 * Publish Att1AttrOverridden
 * @param {object} doRefresh -doRefresh
 * @param {object} inInfoPanel -inInfoPanel
 * @param {object} newAttrUid -newAttrUid
 */
function _publishAtt1AttrOverridden( doRefresh, inInfoPanel, newAttrUid ) {
    if( doRefresh ) {
        if( inInfoPanel ) {
            eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
            appCtxSvc.ctx.selected = newAttrUid;
        } else {
            var newAttr = cdm.getObject( newAttrUid );
            var eventData = {
                newAttrObj: newAttr
            };
            eventBus.publish( 'Att1AttrOverridden', eventData );
        }
    }
}

/**
 * getOpenedObject
 */
function getOpenedObject( inInfoPanel, subPanelContext ) {
    var openedObject = null;

    if( inInfoPanel ) {
        openedObject = appCtxSvc.getCtx( 'selected' );
    } else {
        openedObject = subPanelContext.openedObject;
    }

    return openedObject;
}

/**
 *
 */
function getnewAttrUid( updatedObjects, currentAttrUid, i, newAttrUid ) {
    if( updatedObjects[ i ].uid !== currentAttrUid ) {
        newAttrUid = updatedObjects[ i ].uid;
    }
    return newAttrUid;
}

export let isAttrOpenedAndOverridden = function( eventMap, subPanelContext ) {
    var inInfoPanel =  subPanelContext && subPanelContext.xrtType === 'INFO';
    var openedObject = getOpenedObject( inInfoPanel, subPanelContext );

    if( openedObject && !cmdMapSvc.isInstanceOf( 'Att0MeasurableAttribute', openedObject.modelType ) ) {
        return;
    }

    var doRefresh = false;
    var updated = eventMap[ 'cdm.updated' ];
    if( updated ) {
        var updatedObjects = updated.updatedObjects;
        var isAbsOccDataUpdated = false;
        var isAttrUpdated = false;
        var isValueUpdated = false;
        var isContextUpdated = false;
        var currentAttrUid = openedObject?.uid;
        var newAttrUid = null;

        if( updatedObjects ) {
            for( var i = 0; i < updatedObjects.length; ++i ) {
                if( cmdMapSvc.isInstanceOf( 'AbsOccData', updatedObjects[ i ].modelType ) ) {
                    isAbsOccDataUpdated = true;
                } else if( cmdMapSvc.isInstanceOf( 'Att0MeasurableAttribute', updatedObjects[ i ].modelType ) ) {
                    isAttrUpdated = true;

                    newAttrUid = getnewAttrUid( updatedObjects, currentAttrUid, i, newAttrUid );
                } else if( cmdMapSvc.isInstanceOf( 'Att0MeasureValue', updatedObjects[ i ].modelType ) ) {
                    isValueUpdated = true;
                } else if( cmdMapSvc.isInstanceOf( 'Crt0AttributeElement', updatedObjects[ i ].modelType ) ) {
                    isContextUpdated = true;
                }
            }

            doRefresh = _isDataUpdated( isAbsOccDataUpdated, isAttrUpdated, isContextUpdated, isValueUpdated, newAttrUid, doRefresh );
        }
    }

    _publishAtt1AttrOverridden( doRefresh, inInfoPanel, newAttrUid );
};

var _getOpenedContext = function( attrProxy ) {
    var contextProp = attrProxy.props.att1AttrContext;
    var openedContext = null;
    if( contextProp && contextProp.dbValues && contextProp.dbValues.length > 0 ) {
        openedContext = contextProp.dbValues[ 0 ];
    }

    return openedContext;
};

export let checkOpenedContext = function( attrProxy ) {
    // if the opened context is null, set it to the selected proxy
    // if it is not null, then it was already set on the server
    var measurableAttr = cdm.getObject( attrProxy.props.att1SourceAttribute.dbValues[ 0 ] );
    var openedContext = _getOpenedContext( attrProxy );
    if( measurableAttr.props.att1OpenedContext === null ) {
        dmSvc.setProperties( [ {
            object: measurableAttr,
            vecNameVal: [ {
                name: 'att1OpenedContext',
                values: [ openedContext ]
            } ]
        } ] ).then( function( response ) {
            if( response && response.ServiceData && response.ServiceData.updated && response.ServiceData.updated.length === 0 ) {
                logger.error( 'error occured while updating measurable attribute opened context' );
            }
        } );
    }
};

export let onAttrSelection = function( eventMap ) {
    if( eventMap ) {
        var eventData = eventMap[ 'mappedAttrTable.gridSelection' ];
        if( !eventData ) {
            eventData = eventMap[ 'showAttrProxyTable.gridSelection' ];
        }
        if( !eventData ) {
            eventData = eventMap[ 'interfaceDefAttrsTable.gridSelection' ];
        }
        if( !eventData ) {
            return;
        }

        // only care about single selection case
        if( !eventData.selectedObjects || eventData.selectedObjects.length !== 1 ) {
            return;
        }

        var treeNode = eventData.selectedObjects[ 0 ];
        if( !cmm.isInstanceOf( 'Att1AttributeAlignmentProxy', treeNode.modelType ) ) {
            return;
        }

        exports.checkOpenedContext( treeNode );
    }
};

/**
 * Att1MeasurableAttributeService factory
 */

export default exports = {
    isAttrOpenedAndOverridden,
    checkOpenedContext,
    onAttrSelection
};
