//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Visibility Handler for Architecture Tab
 *
 * @module js/AMVisibilityHandler
 */
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';

/**
 * Toggle Visibility of object
 *
 * @param {Object} modelObject object to toggle visibility for
 */
var toggleVisibility = function( modelObject ) {
    let relationDataProvider;
    if( appCtxSvc.ctx.panelContext && appCtxSvc.ctx.panelContext.graphState && appCtxSvc.ctx.panelContext.graphState.relationsPanel
        && appCtxSvc.ctx.panelContext.graphState.relationsPanel.relationDataProvider ) {
        relationDataProvider = appCtxSvc.ctx.panelContext.graphState.relationsPanel.relationDataProvider;
    }
    if ( appCtxSvc && modelObject ) {
        var selectedViewModelObjects = [];
        var isRelationProxy = cmm.isInstanceOf( 'Ase0RelationProxyObject', modelObject.modelType );
        if ( isRelationProxy ) {
            if ( relationDataProvider ) {
                selectedViewModelObjects = relationDataProvider.getSelectedObjects();
                if ( !_.find( selectedViewModelObjects, [ 'uid', modelObject.uid ] ) ) {
                    // if clicked object is not in selection list, ignore selection list
                    selectedViewModelObjects = [];
                }
            }

            toggleRelatedObjectVisibility( modelObject, selectedViewModelObjects );

            return;
        }

        if ( isOccVisible( modelObject ) ) {
            eventBus.publish( 'AM.toggleOffVisibilityEvent', {
                elementsToRemove: [ modelObject ]
            } );
        } else {
            eventBus.publish( 'AM.toggleOnVisibilityEvent', {
                elementsToAdd: [ modelObject ]
            } );
        }
    }
};

/**
 * Toggle Visibility for related objects
 *
 * @param {Object} clickedObject object clicked to toggle visibility
 * @param {Array} selectedObjects selected objects
 */
var toggleRelatedObjectVisibility = function( clickedObject, selectedObjects ) {
    var isObjectVisible = isOccVisible( clickedObject );
    if ( !isObjectVisible ) {
        var objectToAdd = [];
        objectToAdd.push( clickedObject );
        _.forEach( selectedObjects, function( selectedObject ) {
            if ( objectToAdd.indexOf( selectedObject ) < 0 ) {
                objectToAdd.push( selectedObject );
            }
        } );
        var eventData1 = {
            elementsToAdd: objectToAdd

        };
        eventBus.publish( 'AM.toggleOnVisibilityEvent', eventData1 );
    } else { //User is going to toggle of connection and tracelink from diagram
        var objectsToRemove = [];
        objectsToRemove.push( cdm.getObject( clickedObject.props.ase0RelationElement.dbValues[0] ) );
        _.forEach( selectedObjects, function( selObject ) {
            if ( cmm.isInstanceOf( 'Ase0RelationProxyObject', selObject.modelType ) ) {
                var selectedRelationUid = selObject.props.ase0RelationElement.dbValues[0];
                var selectedRelationObject = cdm.getObject( selectedRelationUid );
                if ( isOccVisible( selectedRelationObject ) ) {
                    if ( objectsToRemove.indexOf( selectedRelationObject ) < 0 ) {
                        objectsToRemove.push( selectedRelationObject );
                    }
                }
            }
        } );
        var eventData2 = {
            elementsToRemove: objectsToRemove
        };
        eventBus.publish( 'AM.toggleOffEvent', eventData2 );
    }
};

/**
 * Check whether occurrence visible on graph
 *
 * @param {Object} modelObject object whose visibility to check
 * @return {Boolean} occurrence visibility true or false
 */
var isOccVisible = function( modelObject ) {
    const graphModel = appCtxSvc.getCtx( 'graph.graphModel' );
    if( modelObject && graphModel ) {
        let uidToCheckVisibility = modelObject.uid;
        let isConnection = false;
        let end1Element;
        let end2Element;
        if( cmm.isInstanceOf( 'Ase0RelationProxyObject', modelObject.modelType ) ) {
            if( modelObject.props.ase0RelationElement ) {
                uidToCheckVisibility = modelObject.props.ase0RelationElement.dbValues[0];
                isConnection = cmm.isInstanceOf( 'Ase0ConnectionRelationProxy', modelObject.modelType );
                if( modelObject.props.ase0Direction.dbValues[0] ) {
                    var direction = modelObject.props.ase0Direction.dbValues[0];
                    if( direction === 'Defining' ) {
                        end2Element = modelObject.props.ase0SelectedElement;
                        end1Element = modelObject.props.ase0RelatedElement;
                    } else if( direction === 'Complying' ) {
                        end2Element = modelObject.props.ase0RelatedElement;
                        end1Element = modelObject.props.ase0SelectedElement;
                    }
                }
            }
        } else {
            isConnection = cmm.isInstanceOf( 'Awb0Connection', modelObject.modelType );
        }
        const nodeModel = graphModel.dataModel.nodeModels[uidToCheckVisibility];
        if( nodeModel ) {
            return nodeModel.graphItem.isVisible();
        }
        const portModel = graphModel.dataModel.portModels[uidToCheckVisibility];
        if( portModel ) {
            return portModel.graphItem.isVisible();
        }
        let edgeModel;
        if( isConnection ) {
            edgeModel = graphModel.dataModel.edgeModels[uidToCheckVisibility];
        } else {
            if( end1Element && end2Element && end1Element.dbValues[0] && end2Element.dbValues[0] ) {
                edgeModel = graphModel.dataModel.edgeModels[ uidToCheckVisibility + '+' + end1Element.dbValues[0] + '+' + end2Element.dbValues[0] ];
            }
        }
        if( edgeModel ) {
            return edgeModel.graphItem.isVisible();
        }
    }
    return false;
};

/**
 * Un-register visibility handler
 * @param {String} occContextKey occ context key
 */
const unRegisterVisiblilityHandlers = function( occContextKey ) {
    appCtxSvc.updatePartialCtx( occContextKey + '.cellVisibility', null );
};

/**
 * Register visibility handler
 * @param {String} occContextKey occ context key
 */
export let registerVisiblilityHandlers = function( occContextKey ) {
    const cellVisibilityValue = {
        getOccVisibility: isOccVisible,
        toggleOccVisibility: toggleVisibility
    };
    appCtxSvc.updatePartialCtx( occContextKey + '.cellVisibility', cellVisibilityValue );
};

const exports = {
    registerVisiblilityHandlers,
    unRegisterVisiblilityHandlers
};
export default exports;
