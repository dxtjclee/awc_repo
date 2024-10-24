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
 *
 *
 * @module js/Ase0ArchitectureLabelService
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cmm from 'soa/kernel/clientMetaModel';

/**
 * Used to set the label on the edge.
 * @param {Object} edgesToUpdate edges
 * @param {Object} graphModel graph Model
 */
export let updateEdgeLabel = function( edgesToUpdate, graphModel ) {
    var graphControl = graphModel.graphControl;
    _.forEach( edgesToUpdate, function( edge ) {
        if( edge && edge.isVisible() ) {
            var propertyObject = null;
            var edgeObject = edge.modelObject;
            if( cmm.isInstanceOf( 'Awb0Connection', edgeObject.modelType ) ) {
                if( edgeObject.props.object_string ) {
                    propertyObject = edgeObject.props.object_string.dbValues;
                }
            } else if( cmm.isInstanceOf( 'FND_TraceLink', edgeObject.modelType ) ) {
                if( edgeObject.props.name ) {
                    propertyObject = edgeObject.props.name.dbValues;
                }
            }

            var edgeLabel = null;
            if( edge.getLabel() ) {
                edgeLabel = edge.getLabel().getText();
            }

            if( propertyObject && edgeLabel && edgeLabel !== propertyObject[ 0 ] ) {
                graphControl.graph.setLabel( edge, propertyObject[ 0 ] );
            }
        }
    } );
};

/**
 * Used to set the label on the port.
 * @param {Object} portsToUpdate ports
 * @param {Object} graphModel graph Model
 */
export let updatePortLabel = function( portsToUpdate, graphModel ) {
    var graphControl = graphModel.graphControl;
    _.forEach( portsToUpdate, function( port ) {
        if( port && port.isVisible() ) {
            var propertyObject = null;
            var portObject = port.modelObject;
            if( portObject.props.object_string ) {
                propertyObject = portObject.props.object_string.dbValues;
            }
            //update the label text if its changed.
            var portLabel = null;
            if( port.getLabel() ) {
                portLabel = port.getLabel().getText();
                if( graphControl && propertyObject && portLabel !== propertyObject[ 0 ] ) {
                    graphControl.graph.setLabel( port, propertyObject[ 0 ] );
                }
            }
        }
    } );
};

export let labelTextChangeAction = function( eventData ) {
    if( eventData.newValue === eventData.oldValue ) {
        return;
    }

    if( eventData.label && eventData.label.getOwner() ) {
        var owner = eventData.label.getOwner();
        if( owner.category === 'Rectangle' ) {
            eventBus.publish( 'AMDiagram.annotationLabelChange' );
        } else if( owner.modelObject ) {
            var modelObject = owner.modelObject;
            var propertyName = exports.getPropertyNameForEdit( modelObject );

            var eventDataForLoadEditing = {
                modelObject: modelObject,
                property: propertyName,
                modelElement: owner,
                updatePropertyValue: eventData.newValue
            };

            eventBus.publish( 'architecture.loadDataForEditing', eventDataForLoadEditing );
        }
    }
};

export let getPropertyNameForEdit = function( modelObject ) {
    var propertyName;
    if( cmm.isInstanceOf( 'Awb0Connection', modelObject.modelType ) ) {
        propertyName = 'awb0DisplayedName';
    } else if( cmm.isInstanceOf( 'FND_TraceLink', modelObject.modelType ) ) {
        propertyName = 'name';
    } else if( cmm.isInstanceOf( 'Awb0Interface', modelObject.modelType ) ) {
        propertyName = 'awb0DisplayedName';
    }
    return propertyName;
};

export let getPropertyName = function( modelObject ) {
    var propertyName;
    if( cmm.isInstanceOf( 'Awb0Connection', modelObject.modelType ) ) {
        propertyName = 'object_string';
    } else if( cmm.isInstanceOf( 'FND_TraceLink', modelObject.modelType ) ) {
        propertyName = 'name';
    } else if( cmm.isInstanceOf( 'Awb0Interface', modelObject.modelType ) ) {
        propertyName = 'object_string';
    }
    return propertyName;
};

const exports = {
    updateEdgeLabel,
    updatePortLabel,
    labelTextChangeAction,
    getPropertyNameForEdit,
    getPropertyName
};
export default exports;
