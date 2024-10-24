// Copyright (c) 2022 Siemens

/**
 * @module js/awMatrixUtils
 */
import awColumnSvc from 'js/awColumnService';

var exports = {};

var isEven = function( index ) {
    return index % 2 === 0;
};

var cellClass = function( grid, row, col, rowRenderIndex, colRenderIndex ) {
    var rowIsEven = isEven( rowRenderIndex );
    var colIsEven = isEven( colRenderIndex );
    var rowid = '';
    if( row.entity.props[ col.field ] === undefined ) {
        if( row.entity.props.object_name ) {
            rowid = row.entity.props.object_name.propertyDescriptor.rowId;
        } else {
            rowid = row.entity.uid;
        }
    } else {
        rowid = row.entity.props[ col.field ].propertyDescriptor.rowId;
    }
    var colid = col.field;
    if( rowid === colid ) {
        return 'aw-matrix-novalue';
    } else if( rowIsEven && colIsEven || !rowIsEven && !colIsEven ) {
        return 'aw-matrix-mixcell';
    } else if( rowIsEven && !colIsEven ) {
        return 'aw-matrix-evencell';
    }
    //executed when ( !rowIsEven && colIsEven )
    return 'aw-matrix-oddcell';
};

/**
 * Method for constructing columns for matrix.
 *
 * @param {Array} columnObjects List of visible nodes in graph
 * @param {Object} pinnedColsInfo pinned Cols Info
 * @param {String} displayProperty display Property
 * @return {Array} Array of aw table columns
 */
export let loadColumns = function( columnObjects, pinnedColsInfo, displayProperty ) { // eslint-disable-line no-unused-vars
    var columnDefns = [];
    var propName;

    var firstColumnInfo = awColumnSvc.createColumnInfo();

    /**
     * Set values for common properties
     */
    firstColumnInfo.name = 'object_name';
    firstColumnInfo.displayName = ' ';
    firstColumnInfo.enableFiltering = false;
    firstColumnInfo.enableColumnResizing = true;
    firstColumnInfo.width = 190;
    firstColumnInfo.minWidth = 100;

    /**
     * Set values for un-common properties
     */
    firstColumnInfo.typeName = 'String';
    firstColumnInfo.enablePinning = true;
    firstColumnInfo.enableSorting = true;
    firstColumnInfo.enableCellEdit = true;
    firstColumnInfo.isColSelected = false;
    firstColumnInfo.displayProperty = displayProperty;
    firstColumnInfo.cellTemplate = '<aw-matrix-row-header class="aw-jswidgets-tablecell" ' +
        'prop="row.entity.props[col.field]" row="row"></aw-matrix-row-header>';

    if( pinnedColsInfo && pinnedColsInfo.length > 0 ) {
        firstColumnInfo.pinnedColumVMO = pinnedColsInfo;
        firstColumnInfo.headerCellTemplate = '<aw-matrix-pinned-column prop="col"></aw-matrix-pinned-column>';
    } else {
        firstColumnInfo.headerCellTemplate = '';
    }

    columnDefns.push( firstColumnInfo );

    for( var colNdx = 0; colNdx < columnObjects.length; colNdx++ ) {
        /**
         * @property {Number|String} width - Number of pixels
         * @memberOf module:js/awColumnService~AwTableColumnInfo
         */
        if( columnObjects[ colNdx ] !== null ) {
            propName = columnObjects[ colNdx ].uid;
            var propDisplayName = '';

            if( displayProperty ) {
                propDisplayName = columnObjects[ colNdx ].props[ displayProperty ].uiValues[ 0 ];
            } else {
                propDisplayName = columnObjects[ colNdx ].props.object_string.uiValues[ 0 ];
            }

            var columnInfo = awColumnSvc.createColumnInfo();

            /**
             * Set values for common properties
             */
            columnInfo.name = propName;
            columnInfo.displayName = propDisplayName;
            columnInfo.enableFiltering = false;
            columnInfo.enableColumnResizing = true;
            columnInfo.width = '48';
            columnInfo.minWidth = '48';
            columnInfo.displayProperty = displayProperty;
            columnInfo.isColSelected = false;

            /**
             * Set values for un-common properties
             */
            columnInfo.typeName = 'String';
            columnInfo.enablePinning = true;
            columnInfo.enableSorting = true;
            columnInfo.enableCellEdit = true;
            columnInfo.headerCellTemplate = '<aw-matrix-column-header title="' + propDisplayName +
                '" prop="col" _colindex="' + colNdx + '"  col-index="renderIndex" ></aw-matrix-column-header>';
            columnInfo.cellTemplate = '<aw-matrix-cell prop="row.entity.props[col.field]" row="row" _colindex="' +
                colNdx + '" title="{{row.entity.cellHeader1}} &#10; &#9679;' + propDisplayName + ' "></aw-matrix-cell>';
            //title above used in header Cell template has hex code which represent new line and dot symbol in html
            //Which is used to show tooltip for cells
            columnInfo.cellClass = cellClass;
            columnDefns.push( columnInfo );
        }
    }

    return columnDefns;
};

export default exports = {
    loadColumns
};
