//@<COPYRIGHT>@
//==================================================
//Copyright 2018.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Interfaces graph layout service
 *
 * @module js/Ase1IntefacesGraphLayoutService
 */
import _ from 'lodash';
import graphConstants from 'js/graphConstants';

/**
 * Activate column layout
 * @param {Object} graphModel Graph Model
 * @param {Object} interfacesCtx Model Data
 * @param {Array} edges Added edges
 */
export let activateColumnLayout = function( graphModel, interfacesCtx, edges ) {
    // var interfacesCtx = appCtxSvc.getCtx( 'interfacesCtx' );
    if( !graphModel || !graphModel.graphControl || !graphModel.graphControl.layout ) {
        return;
    }
    var layout = graphModel.graphControl.layout;
    if( layout.type !== graphConstants.DFLayoutTypes.ColumnLayout ) {
        return;
    }

    //deactivate the column layout before next activation
    if( layout.isActive() ) {
        layout.deactivate();
    }

    //set layout options
    var columnDataArray = [];
    var columnDataList = [];
    var column1 = [];
    var column2 = [];
    var column3 = [];
    if( interfacesCtx.visibleExternalSystems && interfacesCtx.visibleExternalSystems.length > 0 ) {
        var maxCount = parseInt( interfacesCtx.visibleExternalSystems.length / 2 );

        if( interfacesCtx.visibleExternalSystems.length % 2 !== 0 ) {
            ++maxCount;
        }
        var counter = 1;
        _.forEach( interfacesCtx.visibleExternalSystems, function( system ) {
            const nodeModel = graphModel.dataModel.nodeModels[ system.nodeObject.uid ];
            if( counter <= maxCount ) {
                column1.push( nodeModel.graphItem );
            } else {
                column3.push( nodeModel.graphItem );
            }
            ++counter;
        } );
    }

    if( interfacesCtx.internalSystems && interfacesCtx.internalSystems.length > 0 ) {
        _.forEach( interfacesCtx.internalSystems, function( system ) {
            const nodeModel = graphModel.dataModel.nodeModels[ system.nodeObject.uid ];
            column2.push( nodeModel.graphItem );
        } );
    } else {
        const nodeModel = graphModel.dataModel.nodeModels[ interfacesCtx.systemOfInterest.nodeObject.uid ];
        column2.push( nodeModel.graphItem );
    }

    columnDataList.push( column1 );
    columnDataList.push( column2 );
    columnDataList.push( column3 );

    if( columnDataList.length > 0 ) {
        _.forEach( columnDataList, function( columnData ) {
            var graphColumnData = {};
            graphColumnData.nodesInColumn = columnData;
            graphColumnData.nodeAlignmentInColumn = 'center';
            graphColumnData.minNodeDistanceInColumn = 27;
            graphColumnData.minColumnDistance = 174;
            columnDataArray.push( graphColumnData );
        } );
    }

    //apply default column layout
    layout.setLayoutDirection( graphConstants.LayoutDirections.LeftToRight );
    layout.activate( columnDataArray, edges );
};

const exports = {
    activateColumnLayout
};

export default exports;
