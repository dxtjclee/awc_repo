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
 * @module js/Ase0AnnotationService
 */
import eventBus from 'js/eventBus';
import graphLegendSvc from 'js/graphLegendService';

/*
 * method to process annotation details from manageDiagram2 SOA response and draw the annotations in graph
 */
export let processAnnotationData = function( activeLegendView, graphModel, diagramInfo ) {
    if( !diagramInfo.annotationCategories || !diagramInfo.annotationPositions ||
        !diagramInfo.annotationLabels || !diagramInfo.annotationLabelPositions ) {
        return;
    }
    if(  diagramInfo.annotationCategories.length !== diagramInfo.annotationPositions.length  ||
         diagramInfo.annotationPositions.length !== diagramInfo.annotationLabels.length  ||
         diagramInfo.annotationLabels.length !== diagramInfo.annotationLabelPositions.length  ||
         diagramInfo.annotationCategories.length !== diagramInfo.annotationLabels.length  ||
         diagramInfo.annotationCategories.length !== diagramInfo.annotationLabelPositions.length  ||
         diagramInfo.annotationPositions.length !== diagramInfo.annotationLabelPositions.length  ) {
        return;
    }

    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;

    for( var idx = 0; idx < diagramInfo.annotationCategories.length; ++idx ) {
        var annotationStyle = graphLegendSvc.getStyleFromLegend( 'annotations', diagramInfo.annotationCategories[ idx ], activeLegendView );
        //Temporary fix for existing issue if user moves away from Architeture tab
        //and then comes back to the architecture page the annotation fill color is set to transparent
        //graphLegendSvc.getStyleFromLegend API should also return fillcolor
        if( !annotationStyle.fillColor ) {
            annotationStyle.fillColor = annotationStyle.color;
        }
        var annotationPosition = {};
        var annotationLabelPosition = {};
        var annotationLabelText = diagramInfo.annotationLabels[ idx ];
        var positions = diagramInfo.annotationPositions[ idx ].split( ':' );

        if( positions.length === 4 ) {
            annotationPosition.x = Number( positions[ 0 ] );
            annotationPosition.y = Number( positions[ 1 ] );
            annotationPosition.width = Number( positions[ 2 ] );
            annotationPosition.height = Number( positions[ 3 ] );
        }

        var annotation = graph.createBoundary( annotationPosition, annotationStyle );
        annotation.configuration = {
            labelStyle: {
                contentStyleClass: 'aw-widgets-cellListCellTitle',
                backgroundStyleClass: 'aw-graph-labelBackground',
                textAlignment: 'MIDDLE',
                allowWrapping: 'true'
            }
        };
        if( annotation ) {
            annotation.category = diagramInfo.annotationCategories[ idx ];
            positions = diagramInfo.annotationLabelPositions[ idx ].split( ':' );
            if( positions.length === 2 ) {
                graph.setLabel( annotation, annotationLabelText, annotation.configuration.labelStyle );
                annotationLabelPosition.x = Number( positions[ 0 ] );
                annotationLabelPosition.y = Number( positions[ 1 ] );

                var annotationLabel = annotation.getLabel();

                annotationLabel.setPosition( annotationLabelPosition );
            }
        }
    }
};

/**
 * Get display Properties for delete Annotations.
 *
 * @param {Object} graphModel graph model
 * @return {Object} selectedAnnotations
 */
export let populateDeleteAnnotationInformation = function( graphModel ) {
    var annotations = [];
    if( graphModel && graphModel.graphControl ) {
        annotations = graphModel.graphControl.getSelected( 'Boundary' );
    }
    var label = '';
    if( annotations && annotations.length === 1 ) {
        label = annotations[0].getLabel().getText();
    }

    return {
        selectedAnnotations: annotations,
        label: label
    };
};

export let deleteAnnotations = function( selectedAnnotations, graphModel, graphState ) {
    const graphStateValue = { ...graphState.value };
    if( selectedAnnotations && selectedAnnotations.length > 0 && graphModel && graphModel.graphControl ) {
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;
        graph.removeBoundaries( selectedAnnotations );
        // save Diagram
        graphStateValue.hasPendingChanges = true;
        eventBus.publish( 'StartSaveAutoBookmarkEvent' );
    }
    graphState.update && graphState.update( graphStateValue );
    return {
        actionState: {}
    };
};

const exports = {
    processAnnotationData,
    populateDeleteAnnotationInformation,
    deleteAnnotations
};
export default exports;
