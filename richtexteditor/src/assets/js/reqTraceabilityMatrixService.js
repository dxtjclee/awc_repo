/* eslint-disable max-lines */
// Copyright (c) 2021 Siemens
/**
 * @module js/reqTraceabilityMatrixService
 */
import appCtxSvc from 'js/appCtxService';
import iconService from 'js/iconService';
import commandsMapService from 'js/commandsMapService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import _ from 'lodash';
import 'd3';
import eventBus from 'js/eventBus';
import reqUtils from 'js/requirementsUtils';
import AwTimeoutService from 'js/awTimeoutService';
import { svgString as MiscCollapse } from 'image/miscCollapse16.svg';
import { popupService } from 'js/popupService';
import { svgString as MiscCollapsedTree } from 'image/miscCollapsedTree12.svg';
import { svgString as MiscExpandedTree } from 'image/miscExpandedTree12.svg';
import { svgString as IndicatorArrowNorthEast } from 'image/indicatorArrowNorthEast16.svg';
import { svgString as IndicatorArrowSouthWest } from 'image/indicatorArrowSouthWest16.svg';
import { svgString as IndicatorArrowBidirectional } from 'image/indicatorArrowBidirectional16.svg';
import { svgString as MiscUnSorted } from 'image/miscUnSorted10.svg';
import { svgString as MiscSortedAscending } from 'image/miscSortedAscending10.svg';
import { svgString as MiscSortedDescending } from 'image/miscSortedDescending10.svg';
//
// d3 this needs to remain here.
//
var d3 = require( 'd3' );

const miscCollapseIcon = MiscCollapse;
const miscCollapsedTreeIcon = MiscCollapsedTree;
const miscExpandedTreeIcon = MiscExpandedTree;
const indicatorArrowNorthEastIcon = IndicatorArrowNorthEast;
const indicatorArrowSouthWestIcon = IndicatorArrowSouthWest;
const indicatorArrowBidirectionalIcon = IndicatorArrowBidirectional;
const unsortedIcon = MiscUnSorted;
const sortedAscendingIcon = MiscSortedAscending;
const sortedDescendingIcon = MiscSortedDescending;
const cell_height = 30;
const cell_width = 60;
const collapse_width = 16;
const sort_control_width = 12;
const type_icon_width = 16;
const extra_width = 14;
const FORTY_FIVE_DEGREE_ANGLE = 0.78;
var matrix_container;
var main_svg;
var matrix = [];
var parentOfTarget;
var parentOfSource;
var network_data;
var titleRowColumn;
var row_nodes;
var col_nodes;
var srcObjectInfo;
var targetObjectInfo;
var isTopRowOrColSelected;
var showColor;
var screen_width;
var screen_height;
var global_network_data;
var titleRowColumn;
var matrix = [];
var selectedCell;
var nodeCompareFunction;
var i18n;
var doit;
var screen_width;
var screen_height;
var selectionEventData = {
    colUid: [],
    rowUid: [],
    operationType: null
};
var lastSelectedPosX = null;
var lastSelectedPosY = null;
var operationType = null;
var totalSelectedCells;
var main_svg;
var matrix_container;
var matrixContainerWidth = 0;
var matrixContainerHeight = 0;
var max_row_width = 200;
var max_row_height = 10;
var max_col_height = 10;
var max_col_width = 200;
var row_labels_origin_x = 30;
var row_labels_origin_y = 0;
var col_labels_origin_x = 0;
var col_labels_origin_y = 0;
var max_row_text = 20;
var max_row_title_text = 25;
var max_col_text = 24;
var active_col_page = 1;
var active_row_page = 1;
var typeIconMap = {};
var treeMode = null;
var scrollX = 0;
var scrollY = 0;
var itemsPerPage = 0;
var currentRowPage = 0;
var currentColPage = 0;
var numberOfColPages = 0;
var numberOfRowPages = 0;
var displayRowFrom = 0;
var displayColFrom = 0;
var displayLimitOfRow = 4;
var displayLimitOfCol = 4;
var colPagingArray = [];
var rowPagingArray = [];
var lastSelectedRow = null;
var lastSelectedCol = null;
var lastSelectedCellColUID = null;
var selectionUids = [];
var _popupRefHiddenObjectTooltip;
var _popupRefClickMenuHideUnhide;
var _popupRefContextMenuHideUnhide;
var _loadingTracelinkPopup = false;
var propertiesToLoad = [ 'awp0CellProperties', 'object_string' ];
var _subPanelContext = null;
// vars for pagination
var _timeoutPaginationScrollPromise;
var startRowCounter = 0;
var startColCounter = 0;
var numberOfRowsToShow = 25;
var numberOfColsToShow = 25;


// Scroll Position from Left and Right
var scrollLeft = 0;
var scrollTop = 0;
// Wrapper Polygon coordinates
var wrapperPolygonCoordinates = '260,27 433,27 260,200';
// Flag to handle splitter drag motion
var isSpliiterDragged = false;
// Dom referenece for the matrix container which has overflow attribute
var matrixContainer;

// cache row/col uid for sort
let sortedRowUID = null;
let sortedColUID = null;
/**
  * Get chevron Icon element
  * @param {String} iconName //
  * @return{Object} - svg element
  */
export let getIcon = function( iconName ) {
    return iconService.getIcon( iconName );
};

/**
  * depending on the view there can be more than one aw-commandBar-horizontal if this is the case
  * we are interested in the last one which is the matrix toolbar.
  * also, different view types such as favorites or matrix will have different height for now
  * the number of command bars seems to be a good way to determine the current state.
  * and, this will get called onWindowResize event to ensure matrix uses all real estate allowed.
  */
export let set_visualization_size = function() {
    var commandBarWidth = 0;

    var commandBars = document.getElementsByClassName( 'aw-relationshipmatrix-commandBarIcon' );
    if( commandBars.length > 0 ) {
        commandBarWidth = document.getElementsByClassName( 'aw-relationshipmatrix-commandBarIcon' )[0];
        matrixContainerWidth = commandBarWidth.offsetWidth;
    }
    var navigationBarHeight = document.getElementsByClassName( 'global-navigation-toolbar' )[ 0 ];
    var tracelinkTable = document.getElementsByClassName( 'aw-layout-sublocationContent' )[0].getElementsByTagName( 'aw-splm-table' );
    if(  tracelinkTable.length > 0 ) {
        matrixContainerHeight = navigationBarHeight.offsetHeight - 190 - 75;
        matrixContainerHeight -= tracelinkTable[0].offsetHeight;
    } else {
        matrixContainerHeight = navigationBarHeight.offsetHeight - 190;
    }
    d3.select( '#matrix_container' )
        .style( 'width', matrixContainerWidth + 'px' )
        .style( 'height', matrixContainerHeight + 'px' )
        .style( 'overflow', 'auto' );
};

/**
  * Function to handle scroll event for pagination
  */
function applyPaginationOnScroll() {
    if( _timeoutPaginationScrollPromise ) {
        AwTimeoutService.instance.cancel( _timeoutPaginationScrollPromise );
        _timeoutPaginationScrollPromise = null;
    }
    _timeoutPaginationScrollPromise = AwTimeoutService.instance( function() {
        _timeoutPaginationScrollPromise = null;

        // Get Start Cells to render
        var startRowCounter1 = Math.floor( matrixContainer.scrollTop / cell_height );
        var startColCounter1 = Math.floor( matrixContainer.scrollLeft / cell_width );
        // Get Number of cells to be rendered
        var matrix_cluster = d3.select( '#matrix_cluster' ).node();
        var numberOfRowsToShow1 = Math.ceil( ( matrixContainer.clientHeight - matrix_cluster.getBBox().y ) / cell_height );
        var numberOfColsToShow1 = Math.ceil( ( matrixContainer.clientWidth - matrix_cluster.getBBox().x ) / cell_width );

        if( startRowCounter1 !== startRowCounter || startColCounter1 !== startColCounter || numberOfRowsToShow1 !== numberOfRowsToShow || numberOfColsToShow1 !== numberOfColsToShow ) {
            startRowCounter = startRowCounter1;
            startColCounter = startColCounter1;
            numberOfRowsToShow = numberOfRowsToShow1;
            numberOfColsToShow = numberOfColsToShow1;
            addMatrixInCluster( network_data, true );
        }
    }, 100 );
}

/**
  * refreshMatrix - this is the entry point to trace link matrix rendering loop.
  *
  * @param {Object} eventData
  */
export let refreshMatrix = function( eventData ) {
    //var eventDataString = JSON.stringify( eventData );
    d3.select( '#main_svg' ).remove();
    matrix_container = d3.select( '#matrix_container' );
    if( !matrixContainer || matrixContainer !== matrix_container.node() ) {
        matrixContainer = matrix_container.node();
    }
    _removeScrollEventForPagination();
    _removeScrollEventOnMatrixContainer();
    _transformSvgOnScroll();

    main_svg = matrix_container.append( 'svg' )
        .attr( 'id', 'main_svg' )
        .attr( 'class', 'aw-relationshipmatrix-mainSvg' )
        .attr( 'overflow', 'auto' );
    d3.select( '#parent_col_header' ).style( 'display', 'none' );
    if( eventData ) {
        if( eventData.matrixMode ) {
            treeMode = eventData.matrixMode;
        } else {
            treeMode = false;
        }
        if( eventData.targetParentObjectInfo && eventData.targetParentObjectInfo.displayName ) {
            parentOfTarget = eventData.targetParentObjectInfo;
        } else {
            parentOfTarget = '';
        }
        if( eventData.srcParentObjectInfo && eventData.srcParentObjectInfo.displayName ) {
            parentOfSource = eventData.srcParentObjectInfo;
        } else {
            parentOfSource = '';
        }
        if( eventData.pageInfo ) {
            active_row_page = eventData.pageInfo.rowPageToNavigate;
            active_col_page = eventData.pageInfo.colPageToNavigate;
        }
        if( eventData.networkData ) {
            network_data = eventData.networkData;
        }
        if( eventData.titleRowColumn ) {
            titleRowColumn = eventData.titleRowColumn;
        }
        if( eventData.showHeatmap ) {
            network_data.showColor = eventData.showHeatmap;
        } else {
            network_data.showColor = false;
        }
        if( eventData.showTracelinkDirection ) {
            network_data.showTracelinkDirection = eventData.showTracelinkDirection;
        } else {
            network_data.showTracelinkDirection = false;
        }
        if( eventData.sortType ) {
            network_data.sortType = eventData.sortType;
        } else {
            network_data.sortType = { sortOn: 'both', sortType: 'NOSORT' };
        }
    }
    var title = d3.select( '#col_header_title' )
        .text( titleRowColumn.col_title );
    d3.select( '.col-title' ).style( 'display', 'block' );
    make_d3_clustergram( network_data );
    paginationHandle( eventData );
};

/*
         Start ==> THIS SECTION CONTAINS METHODS RELATED TO MANAGE AND HANDLE SCROLLING ON THE TRACEABILITY MATRIX SVG
 */

/**
  *
  * Method to remove the _handleTransformSVG handler which aids in freeze scrolling.
  */
const _removeScrollEventOnMatrixContainer = () => {
    if( matrixContainer ) {
        matrixContainer.removeEventListener( 'scroll', _handleTransformSVG );
    }
};

/**
  * Method to remove the applyPaginationOnScroll handler which aids in pagination scrolling.
  */
const _removeScrollEventForPagination = () => {
    if( matrixContainer ) {
        matrixContainer.removeEventListener( 'scroll', applyPaginationOnScroll );
    }
};

/**
  *
  * Method to scroll/sync groups inside the main svg.
  */
const _handleTransformSVG = () => {
    let rowLabelsID = '#row_labels';
    let columnLablesID = '#col_labels';
    if( scrollLeft !== matrixContainer.scrollLeft ) {
        // horizontally scrolled
        scrollLeft = matrixContainer.scrollLeft;
        d3.select( rowLabelsID )
            .attr( 'transform', `translate(${scrollLeft},${max_col_width})` );
    }
    if( scrollTop !== matrixContainer.scrollTop ) {
        // vertically scrolled
        scrollTop = matrixContainer.scrollTop;
        d3.select( columnLablesID )
            .attr( 'transform', `translate(30,${scrollTop})` );
        d3.select( '#row_header' )
            .attr( 'transform', `translate(0,${scrollTop})` );
    }
    // Manage translation of row & column headers
    d3.select( '#matrix_header' )
        .attr( 'transform', `translate(${scrollLeft},${scrollTop})` );
    d3.select( '.col_label_header' )
        .attr( 'transform', `translate(${scrollLeft},${scrollTop})` );
    d3.select( '.aw-traceability-matrix-rollupCell' )
        .attr( 'transform', `translate(${scrollLeft},${scrollTop})` );
};

/**
  *
  * Method to add the _handleTransformSVG handler which aids in freeze scrolling.
  */
const _transformSvgOnScroll = () => {
    if( matrixContainer ) {
        matrixContainer.addEventListener( 'scroll', _handleTransformSVG );
    }
};

/**
  * Method to add the applyPaginationOnScroll handler which aids in pagination scrolling.
  */
const _addScrollEventForPagination = () => {
    if( matrixContainer ) {
        matrixContainer.addEventListener( 'scroll', applyPaginationOnScroll );
    }
};

/**
  * @param {Array} firstRow - It's the first row of the matrix cluster
  *
  * Method to attach first row of the matrix cluster to column labels
  */
const _attachRowtoColumnLabels = ( firstRow, gTotalCellIndex, textLinkTotalIndex ) => {
    const columnLabelsSection = main_svg.select( '#col_labels' );
    columnLabelsSection
        .append( 'g' )
        .attr( 'class', 'row_lines' )
        .selectAll( '.cell' )
        .data( firstRow )
        .enter()
        .append( 'g' )
        .attr( 'class', 'g-cell' )
        .classed( 'aw-relationshipmatrix-totalCell', function( d ) { return d.pos_y === 0 || d.pos_x === 0; } )
        .on( 'mouseover', function( p ) {
            highlightSelection( this, p, false );
        } )
        .on( 'mouseout', function mouseout() {
            clearHighlight();
        } );

    columnLabelsSection
        .selectAll( '.g-cell' )
        .append( 'rect' )
        .attr( 'class', function( d ) {
            return String( 'cell' + ' cell' + d.pos_x ) + d.pos_y;
        } )
        .attr( 'x', function( d ) {
            if( d.isPreviousColObjectHidden ) {
                gTotalCellIndex += 5;
                return gTotalCellIndex;
            } else if( d.pos_x === 1 ) {
                gTotalCellIndex = d.pos_x * cell_width + max_row_width;
                return gTotalCellIndex;
            }
            gTotalCellIndex += cell_width;
            return gTotalCellIndex;
        } )
        .classed( 'inactive', function( d ) { return d.rowUid === d.colUid; } )
        .attr( 'y', function() {
            return max_col_width;
        } )
        .attr( 'width', function( d ) {
            if( d.isColHidden ) {
                return 5;
            }
            return cell_width;
        } )
        .attr( 'height', cell_height )
        .style( 'fill', '#DCDCDC' )
        .on( 'click', function( d ) {
            handleCellSelection( this, d );
            highlightSelection( this, d, false );
        } );

    columnLabelsSection
        .selectAll( '.aw-relationshipmatrix-cell .cell' )
        .classed( 'heated', function( d ) { return d.value > 0 && showColor; } )
        .attr( 'opacity', function( d ) {
            return d.value > 0 && showColor ? d.value : 1;
        } );

    columnLabelsSection
        .selectAll( '.aw-relationshipmatrix-cell' ).append( 'svg' )
        .attr( 'class', 'traceability_icon aw-relationshipmatrix-link' )
        .attr( 'x', function( d ) {
            return d.pos_x * cell_width + max_row_width + cell_width / 2;
        } )
        .attr( 'y', function() {
            return max_col_width + 8;
        } )
        .on( 'click', function( d ) {
            handleCellSelection( this, d );
            highlightSelection( this, d, false );
        } )
        .on( 'mouseover', function( d ) {
            highlightSelection( this, d, false );
        } )
        .each( add_tracelinkIcon_function );

    columnLabelsSection
        .selectAll( '.g-cell' ).append( 'text' )
        .style( 'direction', 'rtl' )
        .attr( 'x', function( d ) {
            if( d.isColHidden && !d.isPreviousColObjectHidden && d.pos_x !== 1 ) {
                textLinkTotalIndex += 40;
                return textLinkTotalIndex;
            } else if( d.isColHidden && !d.isPreviousColObjectHidden && d.pos_x === 1 ) {
                textLinkTotalIndex += d.pos_x * cell_width + max_row_width + 5;
                return textLinkTotalIndex;
            } else if( d.isColHidden && d.isPreviousColObjectHidden ) {
                textLinkTotalIndex += 5;
                return textLinkTotalIndex;
            } else if( !d.isColHidden && d.isPreviousColObjectHidden ) {
                textLinkTotalIndex += 25;
                return textLinkTotalIndex;
            } else if( d.pos_x === 1 ) {
                textLinkTotalIndex = d.pos_x * cell_width + max_row_width + 25;
                return textLinkTotalIndex;
            }
            textLinkTotalIndex += cell_width;
            return textLinkTotalIndex;
        } )
        .attr( 'y', function() {
            return max_col_width + 20;
        } )
        .text( function( d ) {
            return d.numLinks && d.numLinks > 0 ? d.numLinks : '';
        } )
        .style( 'font-weight', 'bold' )
        .style( 'opacity', function( d ) {
            if( d.isColHidden || d.isRowHidden ) {
                return 0;
            }
        } )
        .on( 'click', function( d ) {
            handleCellSelection( this, d );
            highlightSelection( this, d, false );
        } )
        .on( 'mouseover', function( d ) {
            highlightSelection( this, d, false );
        } );
    columnLabelsSection
        .selectAll( '.aw-relationshipmatrix-totalCell' ).append( 'svg' )

        .attr( 'class', function( d ) {
            if( d.isColHidden ) {
                return 'aw-relationshipmatrix-sortControl aw-relationshipmatrix-button hidden';
            }
            return 'aw-relationshipmatrix-sortControl aw-relationshipmatrix-button';
        } )
        .on( 'click', reorder_click_col )
        .attr( 'x', function( d ) {
            if( d.isColHidden && !d.isPreviousColObjectHidden && d.pos_x !== 1 ) {
                textLinkTotalIndex += 40;
                return textLinkTotalIndex + 10;
            } else if( d.isColHidden && !d.isPreviousColObjectHidden && d.pos_x === 1 ) {
                textLinkTotalIndex += d.pos_x * cell_width + max_row_width + 5;
                return textLinkTotalIndex + 10;
            } else if( d.isColHidden && d.isPreviousColObjectHidden ) {
                textLinkTotalIndex += 5;
                return textLinkTotalIndex + 10;
            } else if( !d.isColHidden && d.isPreviousColObjectHidden ) {
                textLinkTotalIndex += 25;
                return textLinkTotalIndex + 10;
            } else if( d.pos_x === 1 ) {
                textLinkTotalIndex = d.pos_x * cell_width + max_row_width + 25;
                return textLinkTotalIndex + 10;
            }
            textLinkTotalIndex += cell_width;
            return textLinkTotalIndex + 10;
        } )
        .attr( 'y', function() {
            return max_col_width + 20 - 10;
        } )
        .attr( 'width', sort_control_width )
        .attr( 'height', sort_control_width )
        .attr( 'data-sort-on', 'individual-col' )
        .each( add_sortIconRow_function );
};

/**
  * @param {Array} firstColumn - It's the first column of the matrix cluster
  *
  * Method to attach first column of the matrix cluster to row labels
  */
const _attachColumntoRowLabels = ( firstColumn, gRowTotalIndex, textLinkTotalRowIndex ) => {
    const rowLabelsSection = d3.select( '#row_labels' );
    // Adding first column of the matrix cluster
    rowLabelsSection
        .append( 'g' )
        .attr( 'class', 'totalCellCount_Column' )
        .style( 'x', 30 )
        .style( 'y', 0 )
        .selectAll( '.sC_row' )
        .data( firstColumn )
        .enter()
        .append( 'g' )
        .attr( 'class', 'row_lines' )
        .attr( 'transform', function( d, i ) {
            // return `translate( 0,${i * cell_height})`;
            return 'translate ( 0,0 )';
        } )
        .append( 'g' )
        .attr( 'class', 'g-cell' )
        .classed( 'aw-relationshipmatrix-totalCell', function( d ) { return d.pos_y === 0 || d.pos_x === 0; } )
        .on( 'mouseover', function( p ) {
            highlightSelection( this, p, false );
        } )
        .on( 'mouseout', function mouseout() {
            clearHighlight();
        } );

    rowLabelsSection
        .selectAll( '.g-cell' )
        .append( 'rect' )
        .attr( 'class', function( d ) {
            return String( 'cell' + ' cell' + d.pos_x ) + d.pos_y;
        } )
        .attr( 'x', function( d ) {
            return max_row_width + 30;
        } )
        .classed( 'inactive', function( d ) {
            return d.rowUid === d.colUid;
        } )
        .attr( 'y', function( d ) {
            if( d.isPreviousRowObjectHidden ) {
                gRowTotalIndex += 5;
                return gRowTotalIndex;
            } else if( d.pos_y === 0 ) {
                gRowTotalIndex = max_col_width - 200 + d.pos_y * cell_height;
                return gRowTotalIndex;
            }
            gRowTotalIndex += cell_height;
            return gRowTotalIndex;
        } )
        .attr( 'width', cell_width )
        .attr( 'height', function( d ) {
            if( d.isRowHidden ) {
                return 5;
            }
            return cell_height;
        } )
        .style( 'fill', '#DCDCDC' )
        .on( 'click', function( d ) {
            handleCellSelection( this, d );
            highlightSelection( this, d, false );
        } );

    rowLabelsSection
        .selectAll( '.aw-relationshipmatrix-cell .cell' )
        .classed( 'heated', function( d ) { return d.value > 0 && showColor; } )
        .attr( 'opacity', function( d ) {
            return d.value > 0 && showColor ? d.value : 1;
        } );

    rowLabelsSection
        .selectAll( '.g-cell' ).append( 'text' )
        .style( 'direction', 'rtl' )
        .attr( 'x', function( d ) {
            return max_row_width + 55;
        } )
        .attr( 'y', function( d ) {
            if( d.isRowHidden && !d.isPreviousColObjectHidden ) {
                textLinkTotalRowIndex += 5;
                return textLinkTotalRowIndex;
            } else if( d.isRowHidden && d.isPreviousColObjectHidden ) {
                textLinkTotalRowIndex += 5;
                return textLinkTotalRowIndex;
            } else if( !d.isRowHidden && d.isPreviousColObjectHidden ) {
                textLinkTotalRowIndex += 30;
                return textLinkTotalRowIndex;
            } else if( d.pos_y === 0 ) {
                textLinkTotalRowIndex = max_col_width - 200 + d.pos_y * cell_height + 20;
                return textLinkTotalRowIndex;
            }
            textLinkTotalRowIndex += cell_height;
            return textLinkTotalRowIndex;
        } )
        .text( function( d ) {
            return d.numLinks && d.numLinks > 0 ? d.numLinks : '';
        } )
        .style( 'font-weight', 'bold' )
        .style( 'opacity', function( d ) {
            if( d.isColHidden || d.isRowHidden ) {
                return 0;
            }
        } )
        .on( 'click', function( d ) {
            handleCellSelection( this, d );
            highlightSelection( this, d, false );
        } )
        .on( 'mouseover', function( d ) {
            highlightSelection( this, d, false );
        } );

    rowLabelsSection
        .selectAll( '.aw-relationshipmatrix-totalCell' ).append( 'svg' )

        .attr( 'class', function( d ) {
            if( d.isRowHidden ) {
                return 'aw-relationshipmatrix-sortControl aw-relationshipmatrix-button hidden';
            }
            return 'aw-relationshipmatrix-sortControl aw-relationshipmatrix-button';
        } )
        .on( 'click', reorder_click_row )
        .attr( 'x', function( d ) {
            return max_row_width + 55 + 10;
        } )
        .attr( 'y', function( d ) {
            if( d.isRowHidden && !d.isPreviousColObjectHidden ) {
                textLinkTotalRowIndex += 5;
                return textLinkTotalRowIndex - 10;
            } else if( d.isRowHidden && d.isPreviousColObjectHidden ) {
                textLinkTotalRowIndex += 5;
                return textLinkTotalRowIndex - 10;
            } else if( !d.isRowHidden && d.isPreviousColObjectHidden ) {
                textLinkTotalRowIndex += 30;
                return textLinkTotalRowIndex - 10;
            } else if( d.pos_y === 0 ) {
                textLinkTotalRowIndex = max_col_width - 200 + d.pos_y * cell_height + 20;
                return textLinkTotalRowIndex - 10;
            }
            textLinkTotalRowIndex += cell_height;
            return textLinkTotalRowIndex - 10;
        } )
        .attr( 'width', sort_control_width )
        .attr( 'height', sort_control_width )
        .attr( 'data-sort-on', 'individual-row' )
        .append( 'g' )
        .style( 'transform', 'rotate(90deg) translate(-3%, -105%)' )
        .each( add_sortIconRow_function );
};

/**
  *
  * Method to remember the positions of different grups in the main svg and sync them up after render of svg.
  */
const _rememberScrollForGroups = () => {
    // Remember Scroll
    d3.select( '#row_labels' )
        .attr( 'transform', `translate(${scrollLeft},${max_col_width})` );

    if( isSpliiterDragged ) {
        d3.select( '#row_labels .totalCellCount_Column' )
            .attr( 'transform', `translate(0,${ 200 - max_col_width })` );
        isSpliiterDragged = false;
    } else {
        d3.select( '#row_labels .totalCellCount_Column' )
            .attr( 'transform', `translate(0,${ max_col_width <= 200 ? Math.abs( max_col_width - 200 ) : 200 - max_col_width})` );
    }

    d3.select( '#col_labels' )
        .attr( 'transform', `translate(30,${scrollTop})` );

    d3.select( '#row_header' )
        .attr( 'transform', `translate(0,${scrollTop})` );

    d3.select( '#matrix_header' )
        .attr( 'transform', `translate(${scrollLeft},${scrollTop})` );

    d3.select( '.col_label_header' )
        .attr( 'transform', `translate(${scrollLeft},${scrollTop})` );

    d3.select( '.aw-traceability-matrix-rollupCell' )
        .attr( 'transform', `translate(${scrollLeft},${scrollTop})` );
};

/**
  *
  * Method to adjust the dimensions of the svg incase the selected object is small.
  */
const _adjustMainSVGDimensions = () => {
    let rowHeaderHeight = Number( d3.select( '#row_header_rect' ).attr( 'height' ) );
    if( rowHeaderHeight < 250 ) {
        let svgHeight = Number( main_svg.attr( 'height' ) );
        d3.select( '#row_header_rect' ).attr( 'height', '250' );
        main_svg.attr( 'height', svgHeight + 250 - rowHeaderHeight );
    }
};

/**
  *
  * Method which returns the svg html markup for displaying the sigma summation icon.
  * @return {String} - Returns the html string
  */
const _getSvgHTML = () => {
    return `<svg id="rollup_sigma" x="${max_row_width + 50 }" y="${max_col_width}" width="20" height="30" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 48 48">
          <linearGradient id="Dark_Blue_Grad_4" data-name="Dark Blue Grad 4" x1="3.2476" y1="3.7524" x2="43.4976" y2="44.0024" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#75b2c5"></stop>
          <stop offset="0.1774" stop-color="#6cacc0"></stop>
          <stop offset="0.4638" stop-color="#549cb2"></stop>
          <stop offset="0.8215" stop-color="#2e839b"></stop>
          <stop offset="1" stop-color="#18748e"></stop>
          </linearGradient>
          <path d="M16.6173,4.5,28.4845,21.5037v2.0315L14.3115,42.5H30.3522a6.5806,6.5806,0,0,0,4.7047-2.0242c.9083-.9083,1.5627-2.808,2.1537-5.9758h3.4185L40,47.5H6.5V45.8128l15.8728-21.21L6.5,2.1872V.5H40.4905V12.5044H37.3184c-.97-3.6952-1.9664-5.4815-2.9939-6.5833S31.6737,4.5,29.738,4.5Z" stroke="#464646" stroke-miterlimit="10" fill="url(#Dark_Blue_Grad_4)"></path>
          </svg>`;
};

/*
         END ==> THIS SECTION CONTAINS METHODS RELATED TO MANAGE AND HANDLE SCROLLING ON THE TRACEABILITY MATRIX SVG
 */

/*
         START ==> THIS SECTION CONTAINS METHODS RELATED TO MANAGE AND HANDLE SORTING IN THE TRACEABILITY MATRIX SVG
 */

/**
  * add_chevronIcon_function
  */
const addSortingIconsForRow = ( node, type ) => {
    if( treeMode ) {
        if( type && type.rowSort === 'ASC' ) {
            node.appendHTML( sortedAscendingIcon );
        } else if( type && type.rowSort === 'DESC' ) {
            node.appendHTML( sortedDescendingIcon );
        } else {
            node.appendHTML( unsortedIcon );
        }
    }
};

/**
  * add_chevronIcon_function
  */
const addSortingIconsForCol = ( node, type ) => {
    if( treeMode ) {
        if( type && type.colSort === 'ASC' ) {
            node.appendHTML( sortedAscendingIcon );
        } else if( type && type.colSort === 'DESC' ) {
            node.appendHTML( sortedDescendingIcon );
        } else {
            node.appendHTML( unsortedIcon );
        }
    }
};

export let invokeSortPopupOnTraceMat = function( evData = false ) {
    let popupData = {
        declView: 'Arm0TraceabilitySortPopup',
        options: {
            whenParentScrolls: 'close',
            placement: 'right',
            reference: d3.event.currentTarget,
            padding: getPadding(),
            autoFocus: true,
            hasArrow: true,
            draggable:false,
            clickOutsideToClose: true,
            forceCloseOthers: false,
            arrowOptions: {
                alignment: 'center',
                offset: 5,
                shift: 15
            }
        }
    };

    let eventData = {
        popupData,
        sortOn: event.currentTarget.getAttribute( 'data-sort-on' ),
        individualSort: evData ? evData : null
    };

    eventBus.publish( 'Arm0TraceabilityMatrix.invokeSortPopupOnTraceMat', eventData );
};

const _markSortingIconOnElement = ( sortedRowUID, type ) => {
    if( sortedRowUID ) {
        let theNode = main_svg.selectAll( '#row_labels .row_lines svg.aw-relationshipmatrix-sortControl.aw-relationshipmatrix-button svg' )
            .filter( function( d ) {
                return d.rowUid === sortedRowUID;
            } );
        if ( theNode.node() && theNode.node().parentNode ) {
            let parentNode = d3.select( theNode.node().parentNode );
            theNode.remove();
            if( type.individualRowSort === 'ASC' ) {
                parentNode.appendHTML( sortedAscendingIcon );
            } else if( type.individualRowSort === 'DESC' ) {
                parentNode.appendHTML( sortedDescendingIcon );
            } else {
                parentNode.appendHTML( unsortedIcon );
            }
        }
    }

    if( sortedColUID ) {
        let theNode = main_svg.selectAll( '#col_labels .row_lines svg.aw-relationshipmatrix-sortControl.aw-relationshipmatrix-button svg' )
            .filter( function( d ) { return d.colUid === sortedColUID; } );
        if ( theNode.node() && theNode.node().parentNode ) {
            let parentNode = d3.select( theNode.node().parentNode );
            theNode.remove();
            if( type.individualColSort === 'ASC' ) {
                parentNode.appendHTML( sortedAscendingIcon );
            } else if( type.individualColSort === 'DESC' ) {
                parentNode.appendHTML( sortedDescendingIcon );
            } else {
                parentNode.appendHTML( unsortedIcon );
            }
        }
    }

    // Add Sorting Icon on col header
    main_svg.select( '.col_label_header' )
        .append( 'svg' )
        .attr( 'x', max_row_width + main_svg.select( '#parent_col_header' ).node().getBoundingClientRect().width + 100 )
        .attr( 'y', 6 )
        .attr( 'width', sort_control_width )
        .attr( 'height', type_icon_width )
        .attr( 'viewbox', '0 0 48 48' )
        .attr( 'class', 'aw-base-icon aw-relationshipmatrix-button' )
        .attr( 'data-sort-on', 'col' )
        .on( 'click', function() {
            invokeSortPopupOnTraceMat();
        } )
        .call( addSortingIconsForCol, network_data.sortType );
};

/*
         END ==> THIS SECTION CONTAINS METHODS RELATED TO MANAGE AND HANDLE SORTING IN THE TRACEABILITY MATRIX SVG
 */

/**
  * make_d3_clustergram - Ideally all d3 code should pass throug here.
  */
export let make_d3_clustergram = function( network_data ) {
    d3.selection.prototype.appendHTML = function( value ) {
        return this.select( function() {
            return this.appendChild( document.importNode( new DOMParser().parseFromString( value, 'text/html' ).body.childNodes[ 0 ], true ) );
        } );
    };
    // special tweak to remove the second vertical scroll bar.
    d3.select( '.aw-layout-summaryContent' )
        .style( 'overflow', 'hidden' );
    max_row_height = 0;
    max_col_height = 0;
    row_labels_origin_x = 30;
    row_labels_origin_y = 0;
    col_labels_origin_x = 0;
    col_labels_origin_y = 0;
    // initialize clustergram variables
    col_nodes = network_data.col_nodes;
    row_nodes = network_data.row_nodes;
    showColor = network_data.showColor;
    i18n = network_data.i18n;
    nodeCompareFunction = network_data.nodeCompareFunction;
    srcObjectInfo = network_data.srcObjectInfo;
    targetObjectInfo = network_data.targetObjectInfo;
    // initialize matrix
    matrix = [];
    row_nodes.forEach( function( tmp, i ) {
        matrix[ i ] = d3.range( col_nodes.length ).map( function( j ) {
            return {
                pos_x: j,
                pos_y: i,
                value: 0,
                group: 0,
                isColHidden: col_nodes[ j ].isHidden,
                isPreviousColObjectHidden: col_nodes[ j ].isPreviousObjectHidden,
                isRowHidden: tmp.isHidden,
                isPreviousRowObjectHidden: tmp.isPreviousObjectHidden
            };
        } );
    } );

    var firstColumn = [];
    let curMatrixElement = null;
    let sourceElementsIndex = new Map();

    // Add information to the matrix
    network_data.links.forEach( function( link ) {
        // transfer link information to the new adj matrix
        if( network_data.col_nodes.length > link.target && network_data.row_nodes.length > link.source ) {
            matrix[ link.source ][ link.target ].value = link.value;
            // transfer group information to the adj matrix
            matrix[ link.source ][ link.target ].group = 1;
            // transfer color
            matrix[ link.source ][ link.target ].color = link.color;
            matrix[ link.source ][ link.target ].text = link.text;
            matrix[ link.source ][ link.target ].numLinks = link.numLinks;
            matrix[ link.source ][ link.target ].colUid = link.colUid;
            matrix[ link.source ][ link.target ].rowUid = link.rowUid;

            // grab and cache first column from the matrix
            if( link.target === 0 ) {
                curMatrixElement = _.cloneDeep( matrix[ link.source ][ link.target ] );
                firstColumn.push( curMatrixElement );
                sourceElementsIndex.set( link.source, link.target );
            }
        }
    } );

    var colIndex = 0;
    var colLabelIndex = 0;
    var hiddenColObjectCount = 0;
    var hiddenRowObjectCount = 0;
    var rowIndex = 0;

    // grab first column and remmove from matrix
    for( let curEle of sourceElementsIndex ) {
        let [ rowIndex ] = curEle;
        matrix[ rowIndex ].shift();
    }
    var firstRow = matrix.shift();

    //////////////////////////////////
    // // // generate matrix_cluster
    //////////////////////////////////
    main_svg.append( 'g' )
        .attr( 'id', 'matrix_cluster' )
        .style( 'x', 200 )
        .style( 'y', 200 )
        .attr( 'class', 'aw-relationshipmatrix-cluster' );

    if( network_data.subPanelContext ) {
        _subPanelContext = network_data.subPanelContext;
    }
    // size of matrix_container for vertical and horizontal scroll bars, and window resize event
    set_visualization_size();

    // Get Number of cells to be rendered
    numberOfRowsToShow = Math.ceil( matrixContainer.clientHeight / cell_height );
    numberOfColsToShow = Math.ceil( matrixContainer.clientWidth / cell_width );

    addMatrixInCluster( network_data, false );

    //////////////////////////////////
    // // // row labels // // //
    //////////////////////////////////
    main_svg.append( 'g' )
        .attr( 'id', 'row_labels' )
        .attr( 'x', row_labels_origin_x )
        .attr( 'y', row_labels_origin_y );

    // Insert Row Header in row labels group
    d3.select( '#row_labels' )
        .append( 'g' )
        .attr( 'id', 'row_header' )
        .attr( 'class', 'row_label_header' )
        .append( 'rect' )
        .attr( 'id', 'row_header_rect' )
        .attr( 'x', matrix_header_x )
        .attr( 'y', matrix_header_y )
        .attr( 'width', cell_height )
        .attr( 'height', row_nodes.length * cell_height );
    main_svg.selectAll( '.row_label_header' )
        .on( 'click', function() {
            if( srcObjectInfo ) {
                handleRowSelection( srcObjectInfo, true, false );
            }
        } );

    d3.select( '#row_header' ).append( 'svg' )
        .attr( 'x', 10 )
        .attr( 'y', 40 )
        .attr( 'width', sort_control_width )
        .attr( 'height', type_icon_width )
        .attr( 'viewbox', '0 0 48 48' )
        .attr( 'class', 'aw-base-icon aw-relationshipmatrix-button' )
        .attr( 'data-sort-on', 'row' )
        .on( 'click', function() {
            invokeSortPopupOnTraceMat();
        } )
        .call( addSortingIconsForRow, network_data.sortType );

    var row_label_obj = d3.select( '#row_labels' )
        .append( 'g' )
        .attr( 'class', 'row_Header_Column' )
        .selectAll( '.row_label_text' )
        .data( row_nodes )
        .enter()
        .append( 'g' )
        .attr( 'class', 'row_label_text' )
        .attr( 'transform', function( d, i ) {
            if( d.isHidden ) {
                hiddenRowObjectCount++;
            }
            if( d.isPreviousObjectHidden ) {
                rowIndex += 5;
                return ' translate(30,' + rowIndex + ')';
            } else if( d.uid === '' ) {
                return 'translate(' + row_labels_origin_x + ',' + i * cell_height + ')';
            }
            rowIndex += cell_height;
            return ' translate(30,' + rowIndex + ')';
        } )
        .on( 'mouseover', function( d ) {
            d3.select( this ).select( 'text' ).classed( 'active', true );
        } )
        .on( 'mouseout', function mouseout() {
            d3.select( this ).select( 'text' ).classed( 'active', false );
        } )
        .on( 'dblclick', function( d ) {
            if( d.isHidden ) {
                var eventData = {
                    unhideObjects: [ d.uid ],
                    isRow: true
                };
                eventBus.publish( 'Arm0Traceability.UnhideAllFromSelected', eventData );
            } else {
                navigate_click_row( d, this );
            }
        } )
        .on( 'click', function( d ) {
            handleRowSelection( d, true, true );
        } )
        .on( 'contextmenu', function( d, i ) {
            d3.event.preventDefault();
            if( selectionUids.indexOf( d.uid ) === -1 ) {
                handleRowSelection( d, true, true );
            }
            invokeContextMenuPopup();
        } );
    var row_label_text_group = main_svg.select( '#row_labels' )
        .selectAll( '.row_label_text' )
        .append( 'g' )
        .attr( 'id', 'row_text_and_buttons' );
    row_label_text_group
        .append( 'text' )
        .attr( 'x', function( d ) {
            return treeMode ? 36 + getIndent( d ) : 19;
        } )
        .attr( 'y', cell_height - 11 )
        .attr( 'class', 'aw-relationshipmatrix-headerText aw-widgets-propertyNonEditValue' )
        .attr( 'full_name', function( d ) {
            return d.name;
        } )
        .text( function( d ) {
            var maxText = max_row_text - d.level * 2;
            return d.name && d.name.length > maxText ? d.name.substring( 0, maxText - 1 ) + '..' : d.name;
        } )
        .append( 'title' ).text( function( d ) { return d.name; } );
    var row_label_items = row_label_obj._groups[ 0 ];
    var row_count = row_label_items ? row_label_items.length : 0;
    var max_row_text_width = 0;
    var max_row_chars = 0;
    for( var i = 0; i < row_nodes.length; i++ ) {
        if( row_nodes[ i ].name.length > max_row_chars ) {
            max_row_chars = row_nodes[ i ].name.length;
        }
    }
    max_row_text_width = max_row_chars * 6 + extra_width + sort_control_width + collapse_width + type_icon_width;
    max_row_height = row_count * cell_height;
    //Reduce max_row_height if rows are hidden
    if( hiddenRowObjectCount > 0 ) {
        var length = hiddenRowObjectCount;
        max_row_height -= length * 25;
    }
    row_label_text_group.insert( 'rect', 'text' )
        .attr( 'class', 'aw-widgets-propertyNonEditRect matrix_header_background' )
        .attr( 'id', 'row-header-label' )
        .attr( 'x', 0 )
        .attr( 'y', 0 )
        .attr( 'width', max_row_width )
        .attr( 'height', function( d ) {
            if( d.isHidden ) {
                return 5;
            }
            return cell_height;
        } )
        .on( 'mouseover', function( d ) {
            //Close if old tooltip is open
            if( _popupRefHiddenObjectTooltip ) {
                popupService.hide( _popupRefHiddenObjectTooltip );
                _popupRefHiddenObjectTooltip = null;
            }
            //Show tooltip on hover
            if( d.isHidden ) {
                var popupData = {};
                popupData.declView = 'Arm0TraceabilityMatrixHiddenObjectTooltip';
                popupData.placement = 'top';
                popupData.isTooltip = true;
                render_popup( d, popupData );
            }
        } )
        .on( 'mouseout', function mouseout() {
            //Close tooltip
            if( _popupRefHiddenObjectTooltip ) {
                popupService.hide( _popupRefHiddenObjectTooltip );
                _popupRefHiddenObjectTooltip = null;
            }
        } )
        .on( 'click', function( d ) {
            //Show popup with the list of hidden objects
            if( d.isHidden ) {
                var popupData = {};
                popupData.declView = 'Arm0TraceabilityMatrixHiddenObjectPopup';
                popupData.placement = 'right';
                popupData.width = 185;
                render_popup( d, popupData );
            }
        } )
        .on( 'contextmenu', function( d, i ) {
            d3.event.preventDefault();
            if( selectionUids.indexOf( d.uid ) === -1 ) {
                handleRowSelection( d, true, true );
            }
            invokeContextMenuPopup();
        } );
    row_label_text_group.append( 'svg' )
        .attr( 'x', function( d ) {
            return treeMode ? getIndent( d ) + 6 : max_row_width - collapse_width;
        } )
        .attr( 'y', 7 )
        .attr( 'width', collapse_width )
        .attr( 'height', collapse_width )
        .on( 'click', function( d ) {
            navigate_click_row( d, this );
        } )
        .attr( 'class', '.aw-relationshipmatrix-button' )
        .each( add_chevronIcon_function );
    row_label_text_group.each( add_row_indent_lines );
    row_label_text_group.append( 'svg' )
        .attr( 'x', function( d ) {
            return treeMode ? 19 + getIndent( d ) : 2;
        } )
        .attr( 'y', 7 )
        .attr( 'width', type_icon_width )
        .attr( 'height', type_icon_width )
        .attr( 'viewbox', '0 0 48 48' )
        .attr( 'class', '.aw-base-icon' )
        .each( add_typeIcon_function );

    var gRowTotalIndex = 0;
    var textLinkTotalRowIndex = 0;
    // Adding first column of the matrix cluster
    _attachColumntoRowLabels( firstColumn, gRowTotalIndex, textLinkTotalRowIndex );

    //////////////////////////////////
    // // // col labels // // //
    //////////////////////////////////
    main_svg.style( 'fill', 'white' ).style( 'stroke', '#969696' ).style( 'stroke-width', '0.7' )
        .append( 'g' )
        .attr( 'id', 'col_labels' )
        .attr( 'x', 0 )
        .attr( 'y', 0 );
    var col_labels_rect = main_svg.select( '#col_labels' )
        .append( 'g' )
        .attr( 'id', 'col_labels_rects' )
        .attr( 'x', 0 )
        .attr( 'y', 0 );
    var col_labels_text_and_buttons = main_svg.select( '#col_labels' )
        .append( 'g' )
        .attr( 'id', 'col_labels_text_and_buttons' )
        .attr( 'x', 0 )
        .attr( 'y', 0 );
    var col_label_rect_obj = main_svg.select( '#col_labels_rects' )
        .selectAll( '.col_rect' )
        .data( col_nodes )
        .enter()
        .append( 'g' )
        .attr( 'class', 'col_rect' )
        .attr( 'transform', function( d, i ) {
            if( d.isHidden ) {
                hiddenColObjectCount++;
            }
            if( d.isPreviousObjectHidden ) {
                colIndex += 5;
                return ' translate(0,' + colIndex + ')';
            } else if( d.uid === '' ) {
                return ' translate(0,' + i * cell_width + ')';
            }
            colIndex += cell_width;
            return ' translate(0,' + colIndex + ')';
        } )
        .on( 'mouseover', function( d ) {
            d3.select( this ).select( 'text' ).classed( 'active', true );
        } )
        .on( 'mouseout', function mouseout() {
            d3.select( this ).select( 'text' ).classed( 'active', false );
        } )
        .on( 'dblclick', function( d ) {
            if( d.isHidden ) {
                var eventData = {
                    unhideObjects: [ d.uid ],
                    isRow: false
                };
                eventBus.publish( 'Arm0Traceability.UnhideAllFromSelected', eventData );
            } else {
                navigate_click_col( d, this );
            }
        } )
        .on( 'contextmenu', function( d, i ) {
            d3.event.preventDefault();
            if( selectionUids.indexOf( d.uid ) === -1 ) {
                handleRowSelection( d, false, true );
            }
            invokeContextMenuPopup();
        } );
    var col_label_obj = main_svg.select( '#col_labels_text_and_buttons' )
        .selectAll( '.col_label' )
        .data( col_nodes )
        .enter()
        .append( 'g' )
        .attr( 'class', 'col_label' )
        .attr( 'transform', function( d, i ) {
            if( d.isPreviousObjectHidden ) {
                colLabelIndex += 5;
                return ' translate(20,' + colLabelIndex + ') rotate(45)';
            } else if( d.uid === '' ) {
                return ' translate(20,' + i * cell_width + ') rotate(45)';
            }
            colLabelIndex += cell_width;
            return ' translate(20,' + colLabelIndex + ') rotate(45)';
        } )
        .on( 'mouseover', function() {
            d3.select( this ).select( 'text' ).classed( 'active', true );
        } )
        .on( 'mouseout', function mouseout() {
            d3.select( this ).select( 'text' ).classed( 'active', false );
        } )
        .on( 'dblclick', function( d ) {
            navigate_click_col( d, this );
        } )
        .on( 'click', function( d ) {
            handleRowSelection( d, false, true );
        } )
        .on( 'contextmenu', function( d, i ) {
            d3.event.preventDefault();
            if( selectionUids.indexOf( d.uid ) === -1 ) {
                handleRowSelection( d, false, true );
            }
            invokeContextMenuPopup();
        } );
    col_label_rect_obj
        .append( 'text' )
        .attr( 'x', 0 )
        .attr( 'y', cell_width )
        .attr( 'dx', function( d ) {
            return collapse_width + sort_control_width + getIndent( d );
        } )
        .attr( 'dy', -( cell_width / 2 ) )
        .attr( 'class', 'aw-widgets-propertyNonEditValue aw-relationshipmatrix-headerText' )
        .text( function( d ) {
            return d.name && d.name.length > max_col_text ? d.name.substring( 0, max_col_text - 1 ) + '..' : d.name;
        } );
    col_label_rect_obj.each( add_col_indent_lines );
    var col_label_items = col_label_rect_obj._groups[ 0 ];
    var col_count = col_label_items ? col_label_items.length : 0;
    var max_col_text_width = 0;
    var max_col_chars = 0;
    for( var i = 0; i < col_nodes.length; i++ ) {
        if( col_nodes[ i ].name.length > max_col_chars ) {
            max_col_chars = col_nodes[ i ].name.length;
        }
    }
    max_col_text_width = max_col_chars * 6 + collapse_width + sort_control_width + type_icon_width + extra_width;
    max_col_text_width *= FORTY_FIVE_DEGREE_ANGLE;
    max_col_height = col_count * cell_width;
    //Reduce max_col_height is columns are hidden
    if( hiddenColObjectCount > 0 ) {
        var length = hiddenColObjectCount;
        max_col_height -= length * 55;
    }
    col_label_rect_obj.insert( 'rect', 'text' )
        .attr( 'class', 'aw-widgets-propertyNonEditRect matrix_header_background' )
        .attr( 'id', 'col-header-rect' )
        .attr( 'x', 0 )
        .attr( 'y', 0 )
        .attr( 'width', max_col_width - 27 )
        .attr( 'height', function( d ) {
            if( d.isHidden ) {
                return 5;
            }
            return cell_width;
        } )
        .on( 'click', function( d ) {
            handleRowSelection( d, false, true );
            //Show popup with the list of hidden objects
            if( d.isHidden ) {
                var popupData = {};
                popupData.declView = 'Arm0TraceabilityMatrixHiddenObjectPopup';
                popupData.placement = 'right';
                popupData.width = 185;
                render_popup( d, popupData );
            }
        } )
        .on( 'mouseover', function( d ) {
            //Close if old tooltip is open
            if( _popupRefHiddenObjectTooltip ) {
                popupService.hide( _popupRefHiddenObjectTooltip );
                _popupRefHiddenObjectTooltip = null;
            }
            //Show tooltip on hover
            if( d.isHidden ) {
                var popupData = {};
                popupData.declView = 'Arm0TraceabilityMatrixHiddenObjectTooltip';
                popupData.placement = 'top';
                popupData.isTooltip = true;
                render_popup( d, popupData );
            }
        } )
        .on( 'mouseout', function mouseout() {
            //Close tooltip
            if( _popupRefHiddenObjectTooltip ) {
                popupService.hide( _popupRefHiddenObjectTooltip );
                _popupRefHiddenObjectTooltip = null;
            }
        } );
    col_label_rect_obj.selectAll( 'text' ).remove();
    col_label_obj.append( 'text' )
        .attr( 'x', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return 36;
            }
        } )
        .attr( 'y', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return cell_width;
            }
        } )
        .attr( 'dx', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return collapse_width + sort_control_width + getIndent( d );
            }
        } )
        .attr( 'dy', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return -( cell_width / 2 );
            }
        } )
        .attr( 'class', 'aw-widgets-propertyNonEditValue aw-relationshipmatrix-headerText' )
        .attr( 'full_name', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return d.name;
            }
        } )
        .text( function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                var maxCol = max_col_text - d.level;
                return d.name && d.name.length > maxCol ? d.name.substring( 0, maxCol - 1 ) + '..' : d.name;
            }
        } )
        .append( 'title' ).text( function( d ) { return d.name; } );

    col_label_obj.insert( 'svg', 'svg' )
        .attr( 'x', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return d.level ? 22 * d.level : 0;
            }
        } )
        .attr( 'y', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return cell_width / 2 - extra_width;
            }
        } )
        .on( 'click', function( d ) {
            navigate_click_col( d, this );
        } )
        .attr( 'width', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return collapse_width;
            }
        } )
        .attr( 'height', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return collapse_width;
            }
        } )
        .attr( 'class', '.aw-relationshipmatrix-button' )
        .each( add_chevronIcon_function );
    col_label_obj.append( 'svg' )
        .attr( 'x', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return 37 + getIndent( d );
            }
        } )
        .attr( 'y', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return 15;
            }
        } )
        .attr( 'width', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return type_icon_width;
            }
        } )
        .attr( 'height', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return type_icon_width;
            }
        } )
        .attr( 'viewbox', function( d ) {
            if( !d.isHidden || d.isHidden === undefined ) {
                return '0 0 48 48';
            }
        } )
        .attr( 'class', '.aw-base-icon' )
        .each( add_typeIcon_function );
    col_labels_text_and_buttons
        .selectAll( '#chevronIcon' )
        .attr( 'transform', function( d ) {
            if( d.isExpanded && treeMode ) {
                return 'rotate(-45,8,8)';
            }
            return 'rotate(0,8,8)';
        } );

    d3.select( '#col_labels' )
        .append( 'polygon' )
        .attr( 'points', wrapperPolygonCoordinates )
        .style( 'fill', 'white' );

    var gTotalCellIndex = 0;
    var textLinkTotalIndex = 0;
    // Attach first row of the matrix cluster to column labels
    _attachRowtoColumnLabels( firstRow, gTotalCellIndex, textLinkTotalIndex );
    //////////////////////////////////
    // // // resize main_svg dynamically
    //////////////////////////////////
    var main_svg_width = max_row_width + max_col_height + 60; // To accommodate the matrix header
    var main_svg_height = max_col_width + max_row_height;
    main_svg.attr( 'x', 0 )
        .attr( 'y', 0 )
        .attr( 'width', main_svg_width + max_col_width )
        .attr( 'height', main_svg_height );

    // Reset scroll where it was earlier
    matrixContainer.scrollTop = scrollTop;
    matrixContainer.scrollLeft = scrollLeft;

    //////////////////////////////////
    // header group
    //////////////////////////////////
    var matrix_header_x = 0;
    var matrix_header_y = 0;

    main_svg.append( 'g' )
        .attr( 'class', 'col_label_header' )
        .append( 'rect' )
        .attr( 'id', 'column_header_rect' )
        .attr( 'x', max_row_width + 90 )
        .attr( 'y', matrix_header_y )
        .attr( 'width', max_col_width + max_col_height - 30 )
        .attr( 'height', 27 );
    main_svg.selectAll( '.col_label_header' )
        .on( 'click', function() {
            if( targetObjectInfo ) {
                handleRowSelection( targetObjectInfo, false, false );
            }
        } );
    var colTitleWidth;
    if( parentOfTarget ) {
        var colTitle = main_svg.selectAll( '.col_label_header' )
            .append( 'text' ).attr( 'x', max_row_width + 90 ).attr( 'dx', 5 ).attr( 'y', 0 ).attr( 'dy', 20 )
            .attr( 'id', 'parent_col_header' )
            .text( function() {
                return parentOfTarget.displayName + ' >';
            } )
            .attr( 'class', 'aw-relationshipmatrix-link aw-jswidget-tab aw-base-tabTitleSelected aw-base-tabTitle breadcrumb-item' )
            .on( 'click', collNavigationUp );
        colTitleWidth = getTitleWidth( colTitle );
        main_svg.select( '#parent_col_header' ).append( 'title' ).text( parentOfTarget.displayName ); // tooltip
        colTitle = d3.selectAll( '.col_label_header' ).append( 'text' )
            .attr( 'x', max_row_width + 90 ).attr( 'dx', colTitleWidth + 8 ).attr( 'y', 0 ).attr( 'dy', 20 )
            .attr( 'class', 'top_left_box_text aw-jswidget-tab aw-base-tabTitleSelected aw-base-tabTitle breadcrumb-item active-breadcrumb' )
            .text( function() {
                return titleRowColumn.col_title;
            } );
        colTitleWidth += getTitleWidth( colTitle );
        main_svg.selectAll( '.col_label_header' ).append( 'text' ).attr( 'id', 'col_pagination' ).attr( 'x', max_row_width + 90 ).attr( 'dx', colTitleWidth + 30 ).attr( 'y', 0 ).attr( 'dy', 20 ).text(
            ' ' );
    } else {
        var colTitle = main_svg.selectAll( '.col_label_header' )
            .append( 'text' ).attr( 'x', max_row_width ).attr( 'dx', 5 ).attr( 'y', 0 ).attr( 'dy', 20 )
            .attr( 'id', 'parent_col_header' )
            .attr( 'class', 'top_left_box_text aw-jswidget-tab aw-base-tabTitleSelected aw-base-tabTitle breadcrumb-item active-breadcrumb' )
            .append( 'tspan' ).attr( 'x', max_row_width + 90 ).attr( 'dx', 5 ).attr( 'y', 0 ).attr( 'dy', 20 )
            .text( function() {
                return titleRowColumn.col_title;
            } );
        colTitleWidth = getTitleWidth( colTitle );
        main_svg.selectAll( '.col_label_header' ).append( 'text' ).attr( 'id', 'col_pagination' ).attr( 'x', max_row_width ).attr( 'dx', colTitleWidth + 30 ).attr( 'y', 0 ).attr( 'dy', 20 ).text( ' ' );
    }
    if( max_row_width + colTitleWidth + extra_width > main_svg_width + max_col_width ) {
        main_svg.attr( 'width', max_row_width + colTitleWidth + extra_width );
        main_svg.select( '#column_header_rect' ).attr( 'width', colTitleWidth + extra_width );
    }
    main_svg.select( '#row_labels' )
        .attr( 'width', max_row_width )
        .attr( 'height', max_row_height )
        .attr( 'transform', 'translate(0,' + max_col_width + ')' );
    col_labels_origin_x = max_row_width;
    col_labels_origin_y = max_col_width;
    var col_transform_origin = String( String( col_labels_origin_x ) + ' ' + col_labels_origin_y );
    main_svg.select( '#col_labels_rects' )
        .attr( 'width', max_col_width )
        .attr( 'height', max_col_height )
        .attr( 'transform', 'skewX(-45) rotate(-90,' + col_labels_origin_x + ',' + col_labels_origin_y + ') translate(' + max_row_width + ',' + max_col_width * 2 + ')' );
    main_svg.select( '#col_labels_text_and_buttons' )
        .attr( 'width', max_col_width )
        .attr( 'height', max_col_height )
        .attr( 'transform', 'rotate(-90,' + col_labels_origin_x + ',' + col_labels_origin_y + ') translate(' + max_row_width + ',' + ( max_col_width + 14 ) + ')' );


    var resizeStart = 0;
    //var matrix_container_width = matrixContainerWidth;
    //var matrix_container_height = matrixContainerHeight;
    var dragResizeRows = d3.drag()
        .on( 'start', function() {
            // max_row_width = d3.event.x;
            resizeStart = d3.select( this ).attr( 'x1' );
        } )
        .on( 'drag', function() {
            d3.select( this ).attr( 'x1', d3.event.x ).attr( 'x2', d3.event.x )
                .attr( 'style', 'opacity: 1; stroke-width: 1;' );
        } )
        .on( 'end', function(  ) {
            var offset = d3.event.x - resizeStart;
            max_row_width += offset;
            max_row_width = max_row_width < 100 ? 100 : max_row_width;
            max_row_text = ( max_row_width - ( extra_width + sort_control_width + collapse_width + type_icon_width ) ) / 6;
            network_data.matrixMode = treeMode;
            wrapperPolygonCoordinates = `${max_row_width + 60 },27 ${max_col_width + max_row_width + 33},27 ${max_row_width + 60 },${max_col_width}`;
            isSpliiterDragged = true;

            refreshMatrix( network_data );
            paginationHandle();
        } );

    var dragResizeCols = d3.drag()
        .on( 'start', function() {
            resizeStart = d3.select( this ).attr( 'y1' );
        } )
        .on( 'drag', function() {
            d3.select( this ).attr( 'y1', d3.event.y ).attr( 'y2', d3.event.y )
                .attr( 'style', 'opacity: 1; stroke-width: 1;' );
        } )
        .on( 'end', function(  ) {
            var offset = d3.event.sourceEvent.layerY - resizeStart;
            max_col_width += offset; // Event Y coord based on main_svg so needs adjustment
            max_col_width = max_col_width < 100 ? 100 : max_col_width;
            max_col_text = ( max_col_width - 34 - ( extra_width + sort_control_width + collapse_width ) ) / 6;
            max_col_text *= 1.42; // column header at 45 degree angle so text can be longer the colome width
            network_data.matrixMode = treeMode;
            wrapperPolygonCoordinates = `${max_row_width + 60 },27 ${max_col_width + max_row_width + 33},27 ${max_row_width + 60 },${max_col_width}`;
            isSpliiterDragged = true;
            refreshMatrix( network_data );
            paginationHandle();
        } );

    main_svg.append( 'g' )
        .attr( 'id', 'matrix_header' )
        .attr( 'class', 'matrix_label_header' )
        .append( 'rect' )
        .attr( 'id', 'matrix_header_rect' )
        .attr( 'x', matrix_header_x )
        .attr( 'y', matrix_header_y )
        .attr( 'width', max_row_width + 90 )
        .attr( 'height', max_col_width + 30 );
    main_svg.select( '.matrix_label_header' )
        .append( 'line' ).attr( 'x1', max_row_width + 90 ).attr( 'y1', 0 ).attr( 'x2', max_row_width + 90 ).attr( 'y2', max_col_width + 30 )
        .attr( 'class', 'aw-relationshipmatrix-colSizeControl' )
        .on( 'dblclick', function() {
            max_row_text = max_row_chars;
            max_row_width = max_row_text_width;
            refreshMatrix( network_data );
        } )
        .call( dragResizeRows );
    main_svg.select( '.matrix_label_header' )
        .append( 'line' ).attr( 'x1', 0 ).attr( 'y1', max_col_width + 30 ).attr( 'x2', max_row_width + 90 ).attr( 'y2', max_col_width + 30 )
        .attr( 'class', 'aw-relationshipmatrix-rowSizeControl' )
        .on( 'dblclick', function() {
            max_col_text = max_col_chars;
            max_col_width = max_col_text_width;
            refreshMatrix( network_data );
        } )
        .call( dragResizeCols );
    // Append the sigma summation SVG on header
    main_svg.append( 'g' )
        .attr( 'class', 'aw-traceability-matrix-rollupCell' )
        .append( 'rect' )
        .attr( 'class', 'aw-traceability-matrix-summationRect' )
        .attr( 'x', max_row_width + 30 )
        .attr( 'y', max_col_width )
        .attr( 'width', cell_width )
        .attr( 'height', cell_height )
        .style( 'fill', '#DCDCDC' );

    main_svg.select( '.aw-traceability-matrix-rollupCell' )
        .append( 'g' )
        .attr( 'class', 'aw-traceability-matrix-summationIcon' )
        .appendHTML( _getSvgHTML() );

    if( parentOfSource ) {
        main_svg.selectAll( '.row_label_header' )
            .append( 'text' ).attr( 'x', 0 ).attr( 'dx', 5 ).attr( 'y', 300 )
            .attr( 'id', 'parent_row_header' )
            .attr( 'transform', 'rotate(-90)' )
            .attr( 'x', -245 ).attr( 'y', 20 )
            .text( function() {
                return parentOfSource.displayName && parentOfSource.displayName.length > max_row_title_text ?
                    parentOfSource.displayName.substring( 0, max_row_title_text - 2 ) + '...' : parentOfSource.displayName;
            } )
            .attr( 'class', 'aw-relationshipmatrix-link top_left_box_text aw-jswidget-tab aw-base-tabTitleSelected aw-base-tabTitle breadcrumb-item' )
            .on( 'click', rowNavigationUp )
            .append( 'title' ).text( parentOfSource.displayName ); // tooltip
        main_svg.selectAll( '.row_label_header' )
            .append( 'text' ).attr( 'x', 0 ).attr( 'dx', 5 ).attr( 'y', 300 ).attr( 'dy', 300 )
            .attr( 'class', 'aw-relationshipmatrix-link top_left_box_text aw-jswidget-tab aw-base-tabTitleSelected aw-base-tabTitle breadcrumb-item' )
            .text( '>' );
        main_svg.selectAll( '.row_label_header' )
            .append( 'text' ).attr( 'x', 0 ).attr( 'dx', 5 ).attr( 'y', 300 ).attr( 'dy', 300 )
            .attr( 'class', 'top_left_box_text aw-jswidget-tab aw-base-tabTitleSelected aw-base-tabTitle breadcrumb-item active-breadcrumb' )
            .text( function() {
                return titleRowColumn.row_title && titleRowColumn.row_title.length > max_row_title_text ?
                    titleRowColumn.row_title.substring( 0, max_row_title_text - 2 ) + '...' : titleRowColumn.row_title;
            } )
            .append( 'title' ).text( titleRowColumn.row_title );
        main_svg.selectAll( '.row_label_header' ).append( 'text' ).attr( 'id', 'row_pagination' ).attr( 'x', 0 ).attr( 'y', max_col_width - 43 ).attr( 'dx', 0 ).attr( 'dy', 40 ).text( ' ' );
    } else {
        main_svg.selectAll( '.row_label_header' )
            .append( 'text' ).attr( 'x', 0 ).attr( 'dx', 5 ).attr( 'y', 0 )
            .attr( 'id', 'parent_row_header' )
            .attr( 'transform', 'rotate(-90)' )
            .attr( 'class', 'top_left_box_text aw-jswidget-tab aw-base-tabTitleSelected aw-base-tabTitle breadcrumb-item active-breadcrumb' )
            .append( 'tspan' ).attr( 'x', function() {
                if( titleRowColumn.row_title && titleRowColumn.row_title.length >= 17 ) {
                    return -245;
                } else if( titleRowColumn.row_title && titleRowColumn.row_title.length < 17 && titleRowColumn.row_title.length >= 13 ) {
                    return -190;
                } else if( titleRowColumn.row_title && titleRowColumn.row_title.length < 13 && titleRowColumn.row_title.length >= 10 ) {
                    return -160;
                } else if( titleRowColumn.row_title && titleRowColumn.row_title.length < 10 ) {
                    return -145;
                }
            } )
            .attr( 'y', 20 )
            .text( function() {
                return titleRowColumn.row_title && titleRowColumn.row_title.length > max_row_title_text ?
                    titleRowColumn.row_title.substring( 0, max_row_title_text - 2 ) + '...' : titleRowColumn.row_title;
            } )
            .append( 'title' ).text( titleRowColumn.row_title );
        main_svg.selectAll( '.row_label_header' ).append( 'text' ).attr( 'id', 'row_pagination' ).attr( 'x', 0 ).attr( 'y', max_col_width - 43 ).attr( 'dx', 0 ).attr( 'dy', 40 ).text( ' ' );
    }

    window.addEventListener( 'resize', function() {
        set_visualization_size();
        applyPaginationOnScroll();
    }, true );

    // remember selection, required for pagination, expand
    rememberSelectionHighlight();

    // Remember scroll positions for row/col/header text
    _rememberScrollForGroups();

    _addScrollEventForPagination();

    // Adjust the dimensions of the svg incase the target/source object is small.
    _adjustMainSVGDimensions();
    _markSortingIconOnElement( sortedRowUID, network_data.sortType );
    hideNumbersFromHeaderOnShowHeatMap( showColor );
};

/**
  * Function to scroll view to selected cell/row/col
  *
  */
var scrollSelectionToView = function() {
    var colSelector = document.querySelector( 'rect.highlightSelected#col-header-rect' );
    if( colSelector ) {
        if( typeof colSelector.scrollIntoViewIfNeeded === 'function' ) {
            colSelector.scrollIntoViewIfNeeded();
        }else if( matrixContainer.scrollLeft > 0 ) {
            colSelector.scrollIntoView();
        }
    }
    var rowSelector = document.querySelector( 'rect.highlightSelected#row-header-label' );
    if( rowSelector ) {
        if( typeof rowSelector.scrollIntoViewIfNeeded === 'function' ) {
            rowSelector.scrollIntoViewIfNeeded();
        } else if( matrixContainer.scrollTop > 0 ) {
            rowSelector.scrollIntoView();
        }
    }
};


/**
  * Resize Matrix View
  */
export let resizeMatrix = function( ) {
    set_visualization_size();
    AwTimeoutService.instance( function() {
        scrollSelectionToView();
    }, 500 );
};

/**
  * Function to register ctx for hidden objects
  *
  */
var registerCtxForHiddenPresent = function() {
    var hiddenObjInSelection = false;
    var nonHiddenInSelection = false;
    for( let index = 0; index < selectionUids.length; index++ ) {
        var element = selectionUids[ index ];
        if( element.indexOf( 'dummyHiddenID' ) !== -1 ) {
            hiddenObjInSelection = true;
        }
        //non hidden obejct selected
        if( element.indexOf( 'dummyHiddenID' ) === -1 ) {
            nonHiddenInSelection = true;
        }
    }
    if( hiddenObjInSelection ) {
        appCtxSvc.registerPartialCtx( 'MatrixContext.MatrixHiddenObjectSelected', true );
    } else {
        appCtxSvc.registerPartialCtx( 'MatrixContext.MatrixHiddenObjectSelected', false );
    }

    if( nonHiddenInSelection ) {
        appCtxSvc.registerPartialCtx( 'MatrixContext.NonHiddenObjectSelected', true );
    } else {
        appCtxSvc.registerPartialCtx( 'MatrixContext.NonHiddenObjectSelected', false );
    }
};
/**
  * Function to Render Cells.
  *
  * @param {*} network_data
  * @param {*} checkForAlreadyLoadedContent
  */
function addMatrixInCluster( network_data, rememberLastSelection ) {
    var rowLineIndex = 0;
    var svgLinkIndex = 0;
    var textLinkIndex = 0;
    var vertLinesIndex = 30;

    // // cluster rows
    var matrix_cluster = d3.select( '#matrix_cluster' );
    var main_svg_width = max_row_width + max_col_height;
    var main_svg_height = max_col_width + max_row_height;

    // Get paginated matrix data
    var paginated_matrix = matrix.slice( startRowCounter, startRowCounter + numberOfRowsToShow )
        .map( function( row ) { return row.slice( startColCounter, startColCounter + numberOfColsToShow ); } );

    matrix_cluster.selectAll( '.g-cell' ).remove(); // Remove already loaded cells
    var hiddenRowCount = 0;
    var initialSkippedRows = matrix.slice( 0, startRowCounter );
    for( let index = 0; index < initialSkippedRows.length; index++ ) {
        if( initialSkippedRows[ index ][ 0 ].isRowHidden ) {
            hiddenRowCount++;
        }
    }
    rowLineIndex = ( startRowCounter + 1 - hiddenRowCount ) * cell_height + hiddenRowCount * 5;

    matrix_cluster
        .selectAll( '.row' )
        .data( paginated_matrix )
        .enter()
        .append( 'g' )
        .attr( 'class', 'row_lines' )
        .attr( 'transform', function( d, i ) {
            //return 'translate (  0,0 )';   //return 'translate (  0,' + i * cell_height + ')';
            if( paginated_matrix[ i ][ 0 ] && paginated_matrix[ i ][ 0 ].isPreviousRowObjectHidden ) {
                rowLineIndex += 5;
                return `translate( 30,${rowLineIndex})`;
            } else if( i === 0 ) {
                // rowLineIndex = 30 + i * cell_height;
                return `translate( 30,${rowLineIndex})`;
            }
            rowLineIndex += cell_height;
            return `translate( 30,${rowLineIndex})`;
        } )
        .each( function( d, gCellIndex ) {
            var thisObject = this;
            row_function( d, thisObject, gCellIndex, textLinkIndex, svgLinkIndex );
        } )
        .append( 'line' )
        .attr( 'x1', max_row_width )
        .attr( 'y1', max_col_width )
        .attr( 'x2', main_svg_width )
        .attr( 'y2', max_col_width );
    matrix_cluster
        .append( 'line' )
        .attr( 'x1', max_row_width )
        .attr( 'y1', main_svg_height )
        .attr( 'x2', main_svg_width )
        .attr( 'y2', main_svg_height );
    // // cluster columns
    matrix_cluster
        .selectAll( '.col' )
        .data( col_nodes )
        .enter()
        .append( 'g' )
        .attr( 'class', 'vert_lines' )
        .append( 'line' )
        .attr( 'x1', max_row_width )
        .attr( 'y1', max_col_width )
        .attr( 'x2', max_row_width )
        .attr( 'y2', main_svg_height )
        .attr( 'transform', function( d, i ) {
            //return 'translate (' + i * cell_width + ',0)';
            if( d.isPreviousObjectHidden ) {
                vertLinesIndex += 5;
                return 'translate (' + vertLinesIndex + ',0)';
            } else if( d.uid === '' ) {
                return 'translate (' + i * cell_width + ',0)';
            }
            vertLinesIndex += cell_width;
            return 'translate (' + vertLinesIndex + ',0)';
        } );
    matrix_cluster
        .append( 'line' )
        .attr( 'x1', main_svg_width + 30 )
        .attr( 'y1', max_col_width )
        .attr( 'x2', main_svg_width + 30 )
        .attr( 'y2', main_svg_height );

    //////////////////////////////////
    // // // Print to PDF does not use stylesheets so apply styles to elements needed for printing
    //////////////////////////////////
    d3.selectAll( '#main_svg text' ).style( 'stroke', 'none' ).style( 'fill', '#464646' );
    d3.selectAll( '.aw-relationshipmatrix-link' ).style( 'fill', '#197fa2' );
    d3.selectAll( '.aw-relationshipmatrix-cell text' ).style( 'text-anchor', 'end' );
    d3.selectAll( '.aw-relationshipmatrix-navControl' ).style( 'stroke', 'none' );
    d3.selectAll( '.inactive' ).style( 'fill', '#f0f0f0' );
    showHeatMap( showColor );
    tracelinkDirectionChangeAction( network_data.showTracelinkDirection );

    if( rememberLastSelection ) {
        rememberSelectionHighlight();
        rememberMultiColumnCellSelection();
    }
}

/**
 * Function to remember multicell selection. Get the selection and highlight the multicolumns
 */
function rememberMultiColumnCellSelection() {
    if( operationType === 'rowWise' && selectionEventData.rowUid.length === 1 ) {
        if( selectionEventData.colUid && selectionEventData.colUid.length > 0 ) {
            //highlight matrix col header for multiple cell selection
            d3.selectAll( '#col-header-rect' ).classed( 'highlightSelected', function( d ) {
                return selectionEventData.colUid.indexOf( d && d.uid ) !== -1;
            } );
            //select cell
            d3.selectAll( '.cell' ).classed( 'selected-cell', function( d ) {
                return selectionEventData.colUid.indexOf( d.colUid ) !== -1 && selectionEventData.rowUid[0] === d.rowUid;
            } );
            d3.selectAll( '.selected-cell' ).attr( 'id', 'clicked_cell' );
        } else {
            d3.selectAll( '.cell' ).classed( 'highlightSelected', function( d ) {
                return selectionUids.indexOf( d.rowUid ) !== -1;
            } );
        }
    }
}


/**
  * Function to remember last selection. Get the selection and highlight rows/cols
  */
function rememberSelectionHighlight() {
    if( selectionUids && selectionUids.length > 0 ) {
        if( lastSelectedRow ) {
            d3.selectAll( '#row-header-label' ).classed( 'highlightSelected', function( d ) {
                removeHiddenObjFromSelectionUids( d );
                return selectionUids.indexOf( d.uid ) !== -1;
            } );
            if( lastSelectedCellColUID ) {
                //for cell selection, select matrix col header
                d3.selectAll( '#col-header-rect' ).classed( 'highlightSelected', function( d ) {
                    return lastSelectedCellColUID === d.uid;
                } );
                // Select cell
                d3.selectAll( '.cell' ).classed( 'selected-cell', function( d ) {
                    return selectionUids.indexOf( d.rowUid ) !== -1 && lastSelectedCellColUID === d.colUid;
                } );
                d3.selectAll( '.selected-cell' ).attr( 'id', 'clicked_cell' );
            } else {
                d3.selectAll( '.cell' ).classed( 'highlightSelected', function( d ) {
                    return selectionUids.indexOf( d.rowUid ) !== -1;
                } );
            }
        }
        if( lastSelectedCol ) {
            d3.selectAll( '#col-header-rect' ).classed( 'highlightSelected', function( d ) {
                removeHiddenObjFromSelectionUids( d );
                return selectionUids.indexOf( d.uid ) !== -1;
            } );
            d3.selectAll( '.cell' ).classed( 'highlightSelected', function( d ) {
                return selectionUids.indexOf( d.colUid ) !== -1;
            } );
        }
    }
}

//Remove hidden column object from selectionUids
var removeHiddenObjFromSelectionUids = function( d ) {
    if( d.isHidden ) {
        for( let index = 0; index < d.hiddenColumnObjects.length; index++ ) {
            var id = d.hiddenColumnObjects[ index ].occurrence.uid;
            _.remove( selectionUids, function( uids ) {
                return id === uids;
            } );
        }
    }
};
export let tracelinkDeleted = function( elementsInDeleteTracelink, tracelinkIDVsMatrixCell, cellDataMap ) {
    var mapKey = tracelinkIDVsMatrixCell[ elementsInDeleteTracelink ];
    for( var i = 0; i < mapKey.length; i++ ) {
        var linkInfo = cellDataMap[ mapKey[ i ] ];
        linkInfo = deteleTracelinkFromMap( linkInfo, elementsInDeleteTracelink );
        cellDataMap[ mapKey[ i ] ] = linkInfo;
    }
};
export let setPageInfo = function( data, colPage, rowPage, totalColumnPages, totalRowPages, displayRowFrom, displayColFrom ) {
    if( !data.pageInfo ) {
        exports.resetPageInfo( data );
    }
    if( colPage ) {
        data.pageInfo.colPageToNavigate = colPage;
    }
    if( rowPage ) {
        data.pageInfo.rowPageToNavigate = rowPage;
    }
    if( totalColumnPages ) {
        data.pageInfo.numberOfColPages = totalColumnPages;
    }
    if( totalRowPages ) {
        data.pageInfo.numberOfRowPages = totalRowPages;
    }
    if( displayColFrom ) {
        data.pageInfo.displayColFrom = displayColFrom;
    }
    if( displayRowFrom ) {
        data.pageInfo.displayRowFrom = displayRowFrom;
    }
};
export let resetPageInfo = function( data ) {
    data.pageInfo = {
        colPageToNavigate: 1,
        rowPageToNavigate: 1,
        displayRowFrom: 1,
        displayColFrom: 1
    };
    data.dispatch( { path: 'data.pageInfo', value: data.pageInfo } );
};
/**
  * get Revision Object.
  *
  * @param {Object} obj - Awb0Element or revision object
  * @return {Object} Revision Object
  */
export let getRevisionObject = function( obj ) {
    var revObject = obj;
    if( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
        revObject = cdm.getObject( obj.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }
    return revObject;
};
export let deteleTracelinkFromMap = function( linkInfo, elementsInDeleteTracelink ) {
    if( linkInfo ) {
        linkInfo.complyingLinksInfo = linkInfo.complyingLinksInfo.filter( function( element ) {
            return element.tracelink.uid !== elementsInDeleteTracelink;
        } );
        linkInfo.definingLinksInfo = linkInfo.definingLinksInfo.filter( function( element ) {
            return element.tracelink.uid !== elementsInDeleteTracelink;
        } );
        linkInfo.numOfLinksOnChildren = linkInfo.complyingLinksInfo.length + linkInfo.definingLinksInfo.length;
    }
    return linkInfo;
};
/**
  * calculateViewerHeight
  */
export let calculateViewerHeight = function() {};
/**
  * get the bounding box of a svg text element
  *
  * note: this is used to determine the size of the breadcrumbs in list mode because tree mode does not have them return 0.
  * note: title width expands automatically when user drags handles.
  * note: return value here to make jasmine test happy
  */
export let getTitleWidth = function( title ) {
    if( title._groups[ 0 ] ) {
        return title._groups[ 0 ][ 0 ].getBoundingClientRect().width;
    }
    return 0;
};
/**
  * prefFilter
  */
export let prefFilter = function( pref ) {
    return pref;
};

/**
  * Method to manage the sort chevrons on row labele
  * @param {Object} d - the data present on the current row
  */
export let add_sortIconRow_function = function( d ) {
    if( d.isHidden || d3.select( this ).node().childNodes.length > 0 && sortedRowUID === d.uid ) {
        return;
    }
    d3.select( this ).select( 'svg' ).remove();
    if( d3.select( this.parentNode ).classed( 'sorted' ) ) {
        d3.select( this ).appendHTML( sortedDescendingIcon );
    } else {
        d3.select( this ).appendHTML( unsortedIcon );
    }
};

/**
  * Method to manage the sort chevrons on col labele
  * @param {Object} d - the data present on the current col
  */
export let add_sortIconCol_function = function( d ) {
    d3.select( this ).attr( 'x', sort_control_width + getIndent( d ) + 10 );
    if( d.isHidden || d3.select( this ).node().childNodes.length > 0 && sortedColUID === d.uid ) {
        return;
    }
    d3.select( this ).select( 'svg' ).remove();
    if( d3.select( this.parentNode ).classed( 'sorted' ) ) {
        d3.select( this ).appendHTML( sortedDescendingIcon );
    } else {
        d3.select( this ).appendHTML( unsortedIcon );
    }
};

/**
  * This will draw the page controls.
  */
// eslint-disable-next-line complexity
export let paginationHandle = function( eventData ) {
    // restore scroll state after refresh
    if( treeMode && scrollX > 0 || scrollY > 0 ) {
        var mtx = d3.select( '#aw-traceability-matrix-widget' ).node().parentNode;
        mtx.scrollLeft = scrollX;
        mtx.scrollTop = scrollY;
        scrollX = 0;
        scrollY = 0;
    }
    if( eventData ) {
        if( !eventData.pageInfo ) {
            return;
        }
        itemsPerPage = eventData.networkData.itemsPerPage;
        currentRowPage = eventData.pageInfo.rowPageToNavigate <= 1 ? 1 : eventData.pageInfo.rowPageToNavigate;
        currentColPage = eventData.pageInfo.colPageToNavigate <= 1 ? 1 : eventData.pageInfo.colPageToNavigate;
        numberOfColPages = eventData.pageInfo.numberOfColPages;
        numberOfRowPages = eventData.pageInfo.numberOfRowPages;
        displayRowFrom = eventData.pageInfo.displayRowFrom;
        displayColFrom = eventData.pageInfo.displayColFrom;
        displayLimitOfRow = 4;
        displayLimitOfCol = 4;
    }
    var xpos = max_row_width + 100;
    var ypos = 20;

    if( !treeMode && numberOfColPages > 1 ) {
        if( currentColPage > 1 && numberOfColPages > displayLimitOfCol ) {
            d3.select( '.col_label_header' )
                .append( 'text' )
                .attr( 'x', xpos )

                .attr( 'y', ypos )

                .text( '<< ' )
                .attr( 'class', 'aw-relationshipmatrix-link' )
                .on( 'click', function() {
                    previousColPageNavigation();
                } );
            xpos += 20;
        }
        colPagingArray = [];
        //Determine total number of col pages
        for( var i = 0; i < numberOfColPages; i++ ) {
            colPagingArray.push( i + 1 );
        }
        //Partition cols for view
        for( var i = displayColFrom; i < Math.min( numberOfColPages + 1, displayColFrom + displayLimitOfCol ); i++ ) {
            var link = d3.select( '.col_label_header' )
                .append( 'text' )
                .attr( 'x', xpos )

                .attr( 'y', ypos )

                .attr( 'id', 'tlpagelink' + i )
                .attr( 'class', 'aw-relationshipmatrix-link' )
                .text( i )
                .on( 'click', function() {
                    var header = d3.select( '.col_label_header' );
                    header.selectAll( 'text' ).classed( 'aw-relationshipmatrix-activeTlPage', false );
                    d3.select( this ).classed( 'aw-relationshipmatrix-activeTlPage', true );
                    active_col_page = parseInt( this.innerHTML );
                    setCurrent( active_col_page, 'col_nodes' );
                } );
            if( i === active_col_page ) {
                link.classed( 'aw-relationshipmatrix-activeTlPage', true );
            }
            xpos += 20;
        }
        if( currentColPage < numberOfColPages && numberOfColPages > displayLimitOfCol ) {
            d3.select( '.col_label_header' )
                .append( 'text' )
                .attr( 'x', xpos )

                .attr( 'y', ypos )

                .text( ' >> ' )
                .attr( 'class', 'aw-relationshipmatrix-link' )
                .on( 'click', function() {
                    nextColPageNavigation();
                } );
        }
    }
    if( !treeMode && numberOfRowPages > 1 ) {
        xpos = 0;
        ypos = max_col_width + 20;


        if( currentRowPage > 1 && numberOfRowPages > displayLimitOfRow ) {
            d3.select( '.aw-traceability-matrix-rollupCell' )
                .append( 'text' )
                .attr( 'x', xpos )

                .attr( 'y', ypos )

                .text( '<< ' )
                .attr( 'class', 'aw-relationshipmatrix-link' )
                .on( 'click', function() {
                    previousRowPageNavigation();
                } );
            xpos += 20;
        }
        rowPagingArray = [];
        //Determine total number of row pages
        for( i = 0; i < numberOfRowPages; i++ ) {
            rowPagingArray.push( i + 1 );
        }
        //Partition rows for view
        for( i = displayRowFrom; i < Math.min( numberOfRowPages + 1, displayRowFrom + displayLimitOfRow ); i++ ) {
            var link = d3.select( '.aw-traceability-matrix-rollupCell' )
                .append( 'text' )
                .attr( 'x', xpos )

                .attr( 'y', ypos )

                .attr( 'id', 'tlpagelink' + i )
                .attr( 'class', 'aw-relationshipmatrix-link' )
                .text( i )
                .on( 'click', function() {
                    var header = d3.select( '.aw-traceability-matrix-rollupCell' );
                    header.selectAll( 'text' ).classed( 'aw-relationshipmatrix-activeTlPage', false );
                    d3.select( this ).classed( 'aw-relationshipmatrix-activeTlPage', true );
                    active_row_page = parseInt( this.innerHTML );
                    setCurrent( active_row_page, 'row_nodes' );
                } );
            if( i === active_row_page ) {
                link.classed( 'aw-relationshipmatrix-activeTlPage', true );
            }
            xpos += 20;
        }
        if( currentRowPage < numberOfRowPages && numberOfRowPages > displayLimitOfRow ) {
            d3.select( '.aw-traceability-matrix-rollupCell' )
                .append( 'text' )
                .attr( 'x', xpos )

                .attr( 'y', ypos )

                .text( ' >> ' )
                .attr( 'class', 'aw-relationshipmatrix-link' )
                .on( 'click', function() {
                    nextRowPageNavigation();
                } );
        }
    }
};
/**
  * paginationHandle
  */
export let setCurrent = function( pageNum, type ) {
    var eventData = {};
    if( type === 'col_nodes' ) {
        eventData.colPageToNavigate = pageNum <= 0 ? 1 : pageNum;
    } else {
        eventData.rowPageToNavigate = pageNum <= 0 ? 1 : pageNum;
    }
    eventBus.publish( 'requirementTraceability.uiPagination', eventData );
};
/**
  * redirectToNextPrevPage
  */
export let redirectToNextPrevPage = function( pageNum, type ) {
    var eventData = {};
    if( type === 'col_nodes' ) {
        eventData.colPageToNavigate = pageNum <= 0 ? 1 : pageNum;
        eventData.displayColFrom = pageNum <= 0 ? 1 : pageNum;
        active_col_page = pageNum;
    } else {
        eventData.rowPageToNavigate = pageNum <= 0 ? 1 : pageNum;
        eventData.displayRowFrom = pageNum <= 0 ? 1 : pageNum;
        active_row_page = pageNum;
    }
    eventBus.publish( 'requirementTraceability.uiPagination', eventData );
};
/**
  * previousRowPageNavigation
  */
export let previousRowPageNavigation = function() {
    if( rowPagingArray.length > 4 && currentRowPage > 4 ) {
        displayRowFrom -= 4;
        redirectToNextPrevPage( displayRowFrom, 'row_nodes' );
    }
};
/**
  * nextRowPageNavigation
  */
export let nextRowPageNavigation = function() {
    if( rowPagingArray.length > displayRowFrom + displayLimitOfRow - 1 ) {
        displayRowFrom += 4;
        redirectToNextPrevPage( displayRowFrom, 'row_nodes' );
    }
};
/**
  * previousColPageNavigation
  */
export let previousColPageNavigation = function() {
    if( colPagingArray.length > 4 && currentColPage > 4 ) {
        displayColFrom -= 4;
        redirectToNextPrevPage( displayColFrom, 'col_nodes' );
    }
};
/**
  * nextColPageNavigation
  */
export let nextColPageNavigation = function() {
    if( colPagingArray.length > displayColFrom + displayLimitOfCol - 1 ) {
        displayColFrom += 4;
        redirectToNextPrevPage( displayColFrom, 'col_nodes' );
    }
};
/**
  * collNavigationUp
  */
export let collNavigationUp = function() {
    var eventData = {
        colUid: parentOfTarget.occurrence.uid,
        colPageToNavigate: 1
    };
    eventBus.publish( 'requirementTraceability.navigateUpOrDown', eventData );
};
/**
  * rowNavigationUp
  */
export let rowNavigationUp = function() {
    var eventData = {
        rowUid: parentOfSource.occurrence.uid,
        rowPageToNavigate: 1
    };
    eventBus.publish( 'requirementTraceability.navigateUpOrDown', eventData );
};
/**
  * add_col_indent_lines
  */
export let add_col_indent_lines = function( data ) {
    var cell = d3.select( this );
    if( treeMode && data.level && data.isHidden ) {
        for( var i = 0; i < data.level; i++ ) {
            cell.append( 'line' ).attr( 'x1', 12 * i + 10 ).attr( 'y1', -30 )
                .attr( 'x2', 12 * i + 10 ).attr( 'y2', 5 ).style( 'stroke-dasharray', 1 ).style( 'stroke-width', 1 );
        }
    } else if( treeMode && data.level ) {
        for( var i = 0; i < data.level; i++ ) {
            cell.append( 'line' ).attr( 'x1', 12 * i + 10 ).attr( 'y1', -30 )
                .attr( 'x2', 12 * i + 10 ).attr( 'y2', 30 ).style( 'stroke-dasharray', 1 ).style( 'stroke-width', 1 );
        }
        if( data.level > 0 ) {
            cell.append( 'line' ).attr( 'x1', 12 * data.level + 10 ).attr( 'y1', 30 )
                .attr( 'x2', 12 * ( data.level - 1 ) + 10 ).attr( 'y2', 30 ).style( 'stroke-dasharray', 1 ).style( 'stroke-width', 1 );
        }
    }
};
/**
  * add_row_indent_lines
  */
export let add_row_indent_lines = function( data ) {
    var cell = d3.select( this );
    if( treeMode && data.level ) {
        for( var i = 0; i < data.level; i++ ) {
            cell.append( 'line' ).attr( 'x1', 12 * i + 8 ).attr( 'y1', 15 )
                .attr( 'x2', 12 * i + 8 ).attr( 'y2', -15 ).style( 'stroke-dasharray', 1 ).style( 'stroke-width', 1 );
        }
        if( data.level > 0 ) {
            cell.append( 'line' ).attr( 'x1', 12 * data.level + 8 ).attr( 'y1', 15 )
                .attr( 'x2', 12 * ( data.level - 1 ) + 8 ).attr( 'y2', 15 ).style( 'stroke-dasharray', 1 ).style( 'stroke-width', 1 );
        }
    }
};
/**
  * add_chevronIcon_function
  */
export let add_chevronIcon_function = function( data ) {
    if( data.isParent && ( !data.isHidden || data.isHidden === undefined ) ) {
        var cell = d3.select( this );
        if( treeMode ) {
            cell.append( 'rect' ).attr( 'class', 'aw-relationshipmatrix-navControl aw-relationshipmatrix-button' )
                .attr( 'x', data.level ? 12 * ( data.level - 1 ) : 0 ).attr( 'y', 0 ).attr( 'height', 12 ).attr( 'width', 12 );
            if( data.isExpanded ) {
                cell.append( 'g' ).attr( 'id', 'chevronIcon' )
                    .appendHTML( miscExpandedTreeIcon );
            } else {
                cell.append( 'g' ).attr( 'id', 'chevronIcon' )
                    .appendHTML( miscCollapsedTreeIcon );
            }
            cell.append( 'line' ).attr( 'x1', max_row_width ).attr( 'y1', 0 )
                .attr( 'x2', max_row_width ).attr( 'y2', max_col_width );
        } else if( !data.isHidden || data.isHidden === undefined ) {
            cell.append( 'rect' ).attr( 'class', 'aw-relationshipmatrix-navControl aw-relationshipmatrix-button' ).attr( 'height', 12 ).attr( 'width', 12 )
                .append( 'title' ).text( i18n.showChildren );
            cell.append( 'g' ).attr( 'id', 'chevronIcon' )
                .appendHTML( miscCollapseIcon );
        }
    }
};
/**
  * Adds a few pixels to display child nodes used when tree mode is enabled.
  */
export let getIndent = function( data ) {
    if( treeMode ) {
        return data.level ? 12 * data.level : -6;
    }
    return 0;
};
/**
  * add_tracelinkIcon_function
  */
export let add_tracelinkIcon_function = function( data ) {
    if( data.text && isNaN( data.text ) ) {
        var cell = d3.select( this );
        cell.attr( 'width', '16px' ).attr( 'height', '16px' );
        if( data.text.indexOf( 'DEFINING' ) !== -1 ) {
            cell.attr( 'class', 'defining traceability_icon aw-relationshipmatrix-link' );
            cell.appendHTML( indicatorArrowSouthWestIcon );
        } else if( data.text.indexOf( 'COMPLYING' ) !== -1 ) {
            cell.attr( 'class', 'complying traceability_icon aw-relationshipmatrix-link' );
            cell.appendHTML( indicatorArrowNorthEastIcon );
        } else if( data.text.indexOf( 'BOTH' ) !== -1 ) {
            cell.attr( 'class', 'bidirectional traceability_icon aw-relationshipmatrix-link' );
            cell.appendHTML( indicatorArrowBidirectionalIcon );
        }
    }
};
/**
  * add_typeIcon_function
  */
export let add_typeIcon_function = function( data ) {
    if( data.type ) {
        if( !typeIconMap[ data.type ] ) {
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.open( 'GET', iconService.getTypeIconURL( data.type ), false );
            xmlHttp.send();
            //Fixed for defect LCS-549771 - MBSE-Icons are different in the Trace link matrix
            //If linearGradient ID of svg is same as other svg's present on matrix then it does not render correctly hence replacing them with unique ID's
            var svgElementText = replaceElementIDWithUniqueID( xmlHttp.responseText );
            typeIconMap[ data.type ] = svgElementText;
        }
        d3.select( this ).appendHTML( typeIconMap[ data.type ] );
    }
};

function replaceElementIDWithUniqueID( text ) {
    var svgElement = document.createElement( 'svg' );
    svgElement.innerHTML = text;
    var linearGradient = svgElement.getElementsByTagName( 'linearGradient' );
    for( let index = 0; index < linearGradient.length; index++ ) {
        var id = linearGradient[ index ].getAttribute( 'id' );
        if( id ) {
            var randomChar = getRandomString( 4 );
            var uniqueID = randomChar.concat( id );
            var html = svgElement.innerHTML;
            html = html.replaceAll( id, uniqueID );
            svgElement.innerHTML = html;
        }
    }
    return svgElement.innerHTML;
}

/**
  * function returns random generated string
  */
function getRandomString( length ) {
    var randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    for( var i = 0; i < length; i++ ) {
        result += randomChars.charAt( Math.floor( Math.random() * randomChars.length ) );
    }
    return result;
}
/**
  * draws the checkerboard
  */
export let row_function = function( row_data, thisObject, gCellIndex, textLinkIndex, svgLinkIndex ) {
    // generate tiles in the current row
    var cell = d3.select( thisObject );
    var hiddenColumnCount = 0;
    //If skipped columns present then calculate hidden columns count from it.
    if( startColCounter > 0 ) {
        //Get rows with skipped columns
        var initialRows = matrix.map( function( row ) { return row.slice( 0, startColCounter ); } );
        //traverse skipped columns and get count of hidden columns
        for( let index = 0; index < initialRows[0].length; index++ ) {
            if( initialRows[ 0 ][ index ].isColHidden ) {
                hiddenColumnCount++;
            }
        }
    }

    gCellIndex = ( startColCounter + 1 - hiddenColumnCount ) * cell_width + max_row_width + hiddenColumnCount * 5;
    cell.selectAll( '.cell' )
        .data( row_data )
        .enter()
        .append( 'g' )
        .attr( 'class', 'g-cell' )
        .classed( 'aw-relationshipmatrix-cell', function( d ) { return d.pos_y !== 0 && d.pos_x !== 0; } )
        .classed( 'aw-relationshipmatrix-totalCell', function( d ) { return d.pos_y === 0 || d.pos_x === 0; } )
        .on( 'mouseover', function( p ) {
            highlightSelection( this, p, false );
        } )
        .on( 'mouseout', function mouseout() {
            clearHighlight();
        } );
    cell.selectAll( '.g-cell' )
        .append( 'rect' )
        .attr( 'class', function( d ) {
            return String( 'cell' + ' cell' + d.pos_x ) + d.pos_y;
        } )
        .attr( 'x', function( d ) {
            if( d.pos_x === startColCounter + 1 ) {
                return gCellIndex;
            } else if( d.isPreviousColObjectHidden ) {
                gCellIndex += 5;
                return gCellIndex;
            }
            gCellIndex += cell_width;
            return gCellIndex;
        } )
        .classed( 'inactive', function( d ) { return d.rowUid === d.colUid; } )
        .attr( 'y', function( d ) {
            // return d.pos_y * cell_height + max_col_width;
            return max_col_width;
        } )
        .attr( 'width', function( d ) {
            if( d.isColHidden ) {
                return 5;
            }
            return cell_width;
        } )
        .attr( 'height', function( d ) {
            if( d.isRowHidden ) {
                return 5;
            }
            return cell_height;
        } )
        .on( 'click', function( d ) {
            if( ( !d.isColHidden || d.isColHidden === undefined ) && ( !d.isRowHidden || d.isRowHidden === undefined ) ) {
                handleCellSelection( this, d );
                highlightSelection( this, d, false );
            }
        } );
    cell.selectAll( '.aw-relationshipmatrix-cell .cell' )
        .classed( 'heated', function( d ) {
            if( d.isColHidden || d.isRowHidden ) {
                return false;
            }
            return d.value > 0 && showColor;
        } )
        .attr( 'opacity', function( d ) {
            return d.value > 0 && showColor ? d.value : 1;
        } )
        .on( 'dblclick', function( d ) {
            if( ( !d.isColHidden || d.isColHidden === undefined ) && ( !d.isRowHidden || d.isRowHidden === undefined ) ) {
                if( d.rowUid !== d.colUid ) {
                    // Create tracelink
                    var eventData = {
                        sourceObject: { uid: [ d.rowUid ] },
                        destObject: { uid: [ d.colUid ] }
                    };
                    rememberScroll();
                    eventBus.publish( 'Arm0Traceability.OpenCreateTracelinkPanel', eventData );
                    highlightSelection( this, d, true );
                }
            }
        } );
    svgLinkIndex = ( startColCounter + 1 - hiddenColumnCount ) * cell_width + max_row_width + cell_width / 2 + hiddenColumnCount * 5;
    cell.selectAll( '.aw-relationshipmatrix-cell' ).append( 'svg' )
        .attr( 'class', 'traceability_icon aw-relationshipmatrix-link' )
        .attr( 'x', function( d ) {
            if( d.pos_x === startColCounter + 1 ) {
                return svgLinkIndex;
            } else if( d.isPreviousColObjectHidden ) {
                svgLinkIndex += 5;
                return svgLinkIndex;
            }
            svgLinkIndex += cell_width;
            return svgLinkIndex;
        } )
        .attr( 'y', function( d ) {
            if( d.isRowHidden ) {
                return max_col_width;
            }
            return max_col_width + 8;
        } )
        .on( 'click', function( d ) {
            handleCellSelection( this, d );
            highlightSelection( this, d, false );
        } ).on( 'mouseover', function( d ) {
            highlightSelection( this, d, false );
        } )
        .each( add_tracelinkIcon_function );
    textLinkIndex = ( startColCounter + 1 - hiddenColumnCount ) * cell_width + max_row_width + 25 + hiddenColumnCount * 5;
    cell.selectAll( '.g-cell' ).append( 'text' )
        .attr( 'x', function( d ) {
            if( d.pos_x === startColCounter + 1 ) {
                return textLinkIndex;
            } else if( d.isPreviousColObjectHidden ) {
                textLinkIndex += 5;
                return textLinkIndex;
            }
            textLinkIndex += cell_width;
            return textLinkIndex;
        } )
        .attr( 'y', function( d ) {
            if( d.isRowHidden ) {
                return max_col_width + 10;
            }
            return max_col_width + 20;
        } )
        .text( function( d ) {
            return d.numLinks && d.numLinks > 0 ? d.numLinks : '';
        } )
        .on( 'click', function( d ) {
            handleCellSelection( this, d );
            highlightSelection( this, d, false );
        } )
        .on( 'mouseover', function( d ) {
            highlightSelection( this, d, false );
        } );
    cell.selectAll( '.aw-relationshipmatrix-cell text' ).attr( 'class', 'aw-relationshipmatrix-link' );
};

/**
  * Render unselect action
  */
export var _handleUnselection = function() {
    var matrixContext = appCtxSvc.getCtx( 'MatrixContext' );
    var obj = matrixContext.matrixObj;
    appCtxSvc.registerCtx( 'selected', obj );
    appCtxSvc.registerCtx( 'mselected', [ obj ] );
    appCtxSvc.registerPartialCtx( 'MatrixContext.selectedOccurrence', [ obj ] );
    d3.selectAll( '.highlightSelected' ).classed( 'highlightSelected', false );
    lastSelectedRow = false;
    lastSelectedCol = false;
};

/**
  * Load objects from selection uids
  *
  * @param {object} loadProperties true or false
  * @return {Object} objects - updated data elements
  */
var _loadObjects = function( loadProperties ) {
    var objects = [];
    _.forEach( selectionUids, function( uid ) {
        var obj = cdm.getObject( uid );
        if( obj ) {
            if( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
                var revid = obj.props.awb0UnderlyingObject.dbValues[ 0 ];
                if( revid ) {
                    obj = cdm.getObject( revid );
                }
            }
            if( loadProperties ) {
                reqUtils.loadModelObjects( [ obj ], propertiesToLoad );
            }
        }
        if( uid.indexOf( 'dummyHiddenID' ) === -1 ) {
            objects.push( obj );
        }
    } );
    return objects;
};

var _loadAllObjects = function( data, isRow, clear, isMultipleSelection, isShiftSelection ) {
    var uidsToLoad = [];
    _.forEach( selectionUids, function( uid ) {
        if( uid.indexOf( 'dummyHiddenID' ) === -1 && uid !== '' ) {
            uidsToLoad.push( uid );
        }
    } );
    dmSvc.loadObjects( uidsToLoad ).then( function() {
        var objects = _loadObjects( true );
        if( !clear || isShiftSelection ) {
            appCtxSvc.registerCtx( 'mselected', objects );
            _renderMatrixSelection( data, isRow, isMultipleSelection );
            registerCtxForHiddenPresent();
        }
    } );
};
/**
  * handle Shift selection
  *
  * @param {object} isRow is row or column
  * @param {object} id id of selection
  * @return {Object} objects - updated data elements
  */
var _handleShiftSelection = function( data, isRow, clear, id, isMultipleSelection, isShiftSelection ) {
    var nodes = isRow ? row_nodes : col_nodes;
    var first_sel = selectionUids[ 0 ];
    var sec_sel = id;
    var obj;
    var load = false;
    if( selectionUids.indexOf( sec_sel ) === -1 ) {
        selectionUids.push( sec_sel );
        obj = cdm.getObject( sec_sel );
        if( !obj ) {
            load = true;
        }
    }
    var flag = 0;
    for( var i = nodes.length - 1; i >= 0; i-- ) {
        if( flag === 1 && selectionUids.indexOf( nodes[ i ].uid ) === -1 ) {
            selectionUids.push( nodes[ i ].uid );
            obj = cdm.getObject( nodes[ i ].uid );
            if( !obj ) {
                load = true;
            }
        }
        if( flag === 1 && ( nodes[ i ].uid === first_sel || nodes[ i ].uid === sec_sel ) ) {
            flag = 2;
        }
        if( flag === 0 && ( nodes[ i ].uid === first_sel || nodes[ i ].uid === sec_sel ) ) {
            flag = 1;
        }
    }
    if( load ) {
        _loadAllObjects( data, isRow, clear, isMultipleSelection, isShiftSelection );
    } else {
        var objects = _loadObjects( true );
        if( !clear || isShiftSelection ) {
            appCtxSvc.registerCtx( 'mselected', objects );
            _renderMatrixSelection( data, isRow, isMultipleSelection );
        }
    }
};

/**
  * Handle Shift selection
  *
  * @param {object} id id of selection
  * @param {object} isMultipleSelection  is multi-select
  * @param {object} obj selected object
  * @param {object} objects selected objects
  * @return {Object} objects - updated data elements
  */
var _handleSelection = function( id, isMultipleSelection, obj, objects ) {
    if( commandsMapService.isInstanceOf( 'Awb0Element', obj.modelType ) ) {
        var revid = obj.props.awb0UnderlyingObject.dbValues[ 0 ];
        if( revid ) {
            obj = cdm.getObject( revid );
        }
    }
    reqUtils.loadModelObjects( [ obj ], propertiesToLoad );
    if( !isMultipleSelection ) {
        selectionUids = [];
        objects = [ obj ];
    } else {
        objects.push( obj );
    }
    if( selectionUids.indexOf( id ) === -1 ) {
        selectionUids.push( id );
    }
    appCtxSvc.registerCtx( 'selected', obj );
    return objects;
};

/**
  * Check Shift selection
  *
  * @param {object} isRow is row or column
  * @param {object} isHeader selection  is header
  * @return {Object} objects - updated data elements
  */
var _checkMultiselection = function( isRow, isHeader, isMultipleCellSelection ) {
    var isMultipleSelection = false;
    var isShiftSelection = false;
    if( ( window.event.ctrlKey || window.event.shiftKey ) && isHeader ) {
        if( window.event.shiftKey ) {
            isShiftSelection = true;
        }
        if( lastSelectedRow === false && lastSelectedCol === false ) {
            isMultipleSelection = false;
        } else if( lastSelectedCol === true && !isRow || lastSelectedRow === true && isRow ) {
            isMultipleSelection = true;
        }
    }
    if( ( window.event.ctrlKey || window.event.shiftKey ) && !isHeader ) {
        isMultipleSelection = isMultipleCellSelection;
    }
    return { isShiftSelection: isShiftSelection, isMultipleSelection: isMultipleSelection };
};
/**
  * Render selection for row or column
  *
  * @param {object} data Link data for cell
  * @param {object} isRow is row or column
  * @param {object} isMultipleSelection is multi-select
  * @param {object} oldSelection is an old selection
  */
var _renderMatrixSelection = function( data, isRow, isMultipleSelection, oldSelection ) {
    if( !oldSelection ) {
        d3.select( '#clicked_cell' ).classed( 'selected-cell', false );
        d3.select( '#clicked_cell' ).attr( 'id', '' );
        if( !isMultipleSelection ) {
            d3.selectAll( '.highlightSelected' ).classed( 'highlightSelected', false );
        }
    }
    lastSelectedCellColUID = null;
    if( isTopRowOrColSelected ) {
        lastSelectedRow = false;
        lastSelectedCol = false;
        if( isRow ) {
            d3.selectAll( '.row_label_header' ).classed( 'highlightSelected', function( d ) {
                return selectionUids.indexOf( data.uid ) !== -1;
            } );
        } else {
            d3.selectAll( '.col_label_header' ).classed( 'highlightSelected', function( d ) {
                return selectionUids.indexOf( data.uid ) !== -1;
            } );
        }
    } else if( isRow ) {
        lastSelectedRow = true;
        lastSelectedCol = false;
        //select matrix row header
        d3.selectAll( '#row-header-label' ).classed( 'highlightSelected', function( d ) {
            return selectionUids.indexOf( d.uid ) !== -1;
        } );
        if( data.uid ) { //on row header selection, select entire matrix row
            d3.selectAll( '.cell' ).classed( 'highlightSelected', function( d ) {
                return selectionUids.indexOf( d.rowUid ) !== -1;
            } );
        } else {
            lastSelectedCellColUID = data.colUid;
            //for cell selection, select matrix col header
            d3.selectAll( '#col-header-rect' ).classed( 'highlightSelected', function( d ) {
                return data.colUid === d.uid;
            } );
        }
    } else {
        lastSelectedCol = true;
        lastSelectedRow = false;
        //select matrix col header
        d3.selectAll( '#col-header-rect' ).classed( 'highlightSelected', function( d ) {
            return selectionUids.indexOf( d.uid ) !== -1;
        } );
        if( data.uid ) { //on col header selection, select entire matrix col
            d3.selectAll( '.cell' ).classed( 'highlightSelected', function( d ) {
                return selectionUids.indexOf( d.colUid ) !== -1;
            } );
        }
    }
};
var _checkSymmetry = function( data ) {
    var isPrevRowSelected = appCtxSvc.getCtx( 'MatrixContext' ).isRowSelected;
    if( srcObjectInfo && srcObjectInfo.uid && targetObjectInfo && targetObjectInfo.uid &&  srcObjectInfo.uid === targetObjectInfo.uid ) {
        if ( isPrevRowSelected && data.isTopCol || !isPrevRowSelected && data.isTopRow ) {
            return false;
        }
    }
    return true;
};

/**
  * Handle object selection
  * @param {object} data Link data for cell
  * @param {object} isRow is row or column
  * @param {object} clear clear selection
  * @param {object} unselect unselect selection
  * @param {object} id id of selection
  * @param {object} isMultipleSelection  is multi-select
  * @param {object} isShiftSelection  is shift selection
  * @param {object} obj selected object
  * @param {object} objects mselected objects
  */
// eslint-disable-next-line complexity
var _handleObjectSelection = function( data, isRow, clear, unselect, id, isMultipleSelection, isShiftSelection, obj, keepOldSelection ) {
    var objects = appCtxSvc.getCtx( 'mselected' );

    var noChangeFromRowToCol = !( lastSelectedRow && !isRow || lastSelectedCol && isRow );
    var prevTopRowOrColSelected = isTopRowOrColSelected;
    isTopRowOrColSelected = data.isTopCol || data.isTopRow;
    if( isTopRowOrColSelected && prevTopRowOrColSelected ) {
        noChangeFromRowToCol = _checkSymmetry( data );
    }
    if( ( selectionUids.length === 1 || window.event && ( window.event.ctrlKey || window.event.shiftKey ) ) && selectionUids.indexOf( id ) !== -1 && ( data.uid && noChangeFromRowToCol ) ) {
        //if selection matches a previous selection, we need  to unselect row/col selection
        //unselect only if the selected row is not the same as the prev selected col and vice-versa (when the same structure is present for rows and columns)
        unselect = true;
        _.remove( selectionUids, function( uids ) {
            return id === uids;
        } );
        if( !isShiftSelection || isShiftSelection && unselect ) {
            if( selectionUids.length === 0 ) {
                clear = true;
                _handleUnselection();
            } else {
                objects = _loadObjects( false );
            }
        }
    } else if( isShiftSelection && isMultipleSelection ) {
        objects = _handleShiftSelection( data, isRow, clear, id, isMultipleSelection, isShiftSelection );
        return;
    }
    if( !unselect && ( !isShiftSelection || isShiftSelection && !isMultipleSelection ) ) {
        objects = _handleSelection( id, isMultipleSelection, obj, objects );
    }
    if( !clear || isShiftSelection ) {
        appCtxSvc.registerCtx( 'mselected', objects );
        _renderMatrixSelection( data, isRow, isMultipleSelection, keepOldSelection );
    }

    var selectedOcc = [];
    for( let index = 0; index < selectionUids.length; index++ ) {
        selectedOcc.push( cdm.getObject( selectionUids[ index ] ) );
    }
    appCtxSvc.registerPartialCtx( 'MatrixContext.isRowSelected', isRow );
    appCtxSvc.registerPartialCtx( 'MatrixContext.isTopRowOrColSelected', isTopRowOrColSelected );
    appCtxSvc.registerPartialCtx( 'MatrixContext.selectedOccurrence', selectedOcc );
    registerCtxForHiddenPresent();
};

/**
  * Handle selection for row or column
  *
  * @param {object} data Link data for cell
  * @param {object} isRow is row or column
  * @param {object} isHeader is row or column header
  * @param {object} clear clear selection
  */
// eslint-disable-next-line complexity
export let handleRowSelection = function( data, isRow, isHeader, clear, keepOldSelection, isMultipleCellSelection ) {
    var isMultipleSelection = false;
    var unselect = false;
    var id;
    var obj;
    var objects = appCtxSvc.getCtx( 'mselected' );

    if( clear ) { //when the selected cell is unselected
        _handleUnselection();
    } else {
        var output = _checkMultiselection( isRow, isHeader, isMultipleCellSelection );
        isMultipleSelection = output.isMultipleSelection;
        var isShiftSelection = output.isShiftSelection;
        if( data.uid ) {
            //on row/col header selection
            id = data.uid;
            obj = cdm.getObject( id );
            data.rowUid = [ id ];
            appCtxSvc.registerCtx( 'Arm0TraceabilityMatrixSelectedCell', data );
        } else if( data.rowUid !== '' && data.colUid !== '' ) {
            //on cell selection
            id = data.rowUid;
            obj = cdm.getObject( id );
        } else {
            d3.selectAll( '.highlightSelected' ).classed( 'highlightSelected', false );
        }
        if( !obj && id && id.indexOf( 'dummyHiddenID' ) === -1 || obj && _.isEmpty( obj.props ) ) {
            dmSvc.loadObjects( [ id ] ).then( function() {
                obj = cdm.getObject( id );
                if( obj ) {
                    _handleObjectSelection( data, isRow, clear, unselect, id, isMultipleSelection, isShiftSelection, obj );
                }
            } );
        } else if( obj ) {
            _handleObjectSelection( data, isRow, clear, unselect, id, isMultipleSelection, isShiftSelection, obj, keepOldSelection );
        }
        //handle selection if hidden object selected
        if( data.isHidden ) {
            //handle deselection
            if( selectionUids.indexOf( id ) !== -1 ) {
                unselect = true;
                _.remove( selectionUids, function( uids ) {
                    return id === uids;
                } );
                if( selectionUids.length === 0 ) {
                    clear = true;
                    _handleUnselection();
                }
            }
            //handle selection
            if( !unselect ) {
                if( !isMultipleSelection ) {
                    selectionUids = [];
                    objects = [ data.uid ];
                    //for single hidden object selection
                    appCtxSvc.registerPartialCtx( 'MatrixContext.NonHiddenObjectSelected', false );
                } else {
                    objects.push( data.uid );
                }
                appCtxSvc.registerPartialCtx( 'MatrixContext.MatrixHiddenObjectSelected', true );
                appCtxSvc.registerPartialCtx( 'MatrixContext.isRowSelected', isRow );
                selectionUids.push( data.uid );
            } else {
                appCtxSvc.registerPartialCtx( 'MatrixContext.MatrixHiddenObjectSelected', false );
            }
            if( !clear ) {
                appCtxSvc.registerCtx( 'selected', data.uid );
                appCtxSvc.registerCtx( 'mselected', objects );
                _renderMatrixSelection( data, isRow, isMultipleSelection );
            }
        }
    }
    //Publish event to refresh existring trace link panel
    eventBus.publish( 'Arm0ExistingTracelinkTree.reloadTable' );
};

/**
  * Show trace links for the selected cell
  * @param {object} element The selected cell element
  * @param {object} data Link data for cell
  */
export let handleCellSelection = function( element, data ) {
    var isMultipleSelection = false;
    var clear = d3.select( element.parentNode ).select( 'rect' ).attr( 'id' ) === 'clicked_cell';
    //Check if selection is multiple. If multiple check if the selection is row wise or col wise
    if( window.event.ctrlKey ) {
        if( lastSelectedPosX === null && lastSelectedPosY === null ) {
            isMultipleSelection = false;
        } else if( operationType === null ) {
            //multi selection is true only if previous selected is different than current selection.
            if( lastSelectedPosX === data.pos_x && lastSelectedPosY !== data.pos_y ) {
                operationType = 'colWise';
                isMultipleSelection = true;
            } else if( lastSelectedPosY === data.pos_y && lastSelectedPosX !== data.pos_x ) {
                operationType = 'rowWise';
                isMultipleSelection = true;
            }
        } else {
            if( operationType === 'rowWise' && lastSelectedPosY === data.pos_y || operationType === 'colWise' && lastSelectedPosX === data.pos_x ) {
                isMultipleSelection = true;
            } else {
                isMultipleSelection = false;
                operationType = null;
            }
        }
    }
    if( !isMultipleSelection ) {
        exports.handleRowSelection( data, true, false, clear, false, isMultipleSelection );
        //If single cell is selected deselect all other previously selected cells and add current selection in selectionEventData
        var height = matrixContainerHeight;
        d3.selectAll( '#clicked_cell' ).attr( 'id', '' ).classed( 'selected-cell', false );
        if( !clear ) {
            var height = matrixContainerHeight;
            if( data.numLinks > 0 && data.colUid && data.rowUid ) {
                height = matrixContainerHeight - 170;
                if( data.numLinks > 3 ) {
                    height = matrixContainerHeight - 266;
                }
            }

            totalSelectedCells = 0;
            selectionEventData.colUid = [ data.colUid ];
            selectionEventData.rowUid = [ data.rowUid ];
            lastSelectedPosX = data.pos_x;
            lastSelectedPosY = data.pos_y;
            d3.select( element.parentNode ).select( 'rect' ).attr( 'id', 'clicked_cell' ).classed( 'selected-cell', true );
        } else {
            selectionEventData.colUid = [];
            selectionEventData.rowUid = [];
        }
        d3.select( '#matrix_container' ).style( 'height', height + 'px' );
    } else {
        //If multiple cells are selected push data in selectionEventData and highlight all selected cells
        if( !clear ) {
            lastSelectedPosX = data.pos_x;
            lastSelectedPosY = data.pos_y;
            totalSelectedCells++;
            if( operationType === 'rowWise' ) {
                selectionEventData.colUid.push( data.colUid );
                selectionEventData.rowUid[ 0 ] = data.rowUid;

                //highlight matrix col header for multiple cell selection
                d3.selectAll( '#col-header-rect' ).classed( 'highlightSelected', function( d ) {
                    return selectionEventData.colUid.indexOf( d && d.uid ) !== -1;
                } );
            } else {
                selectionEventData.colUid[ 0 ] = data.colUid;
                selectionEventData.rowUid.push( data.rowUid );
                //select matrix row obj for multiple cell selection
                exports.handleRowSelection( data, true, false, clear, true, isMultipleSelection );
            }

            d3.select( element.parentNode ).select( 'rect' ).attr( 'id', 'clicked_cell' ).classed( 'selected-cell', true );
        } else {
            totalSelectedCells--;
            if( operationType === 'rowWise' ) {
                for( var i = 0; i < selectionEventData.colUid.length; i++ ) {
                    if( selectionEventData.colUid[ i ] === data.colUid ) {
                        selectionEventData.colUid.splice( i, 1 );
                        break;
                    }
                }

                //Deselect col header and only highlight selected col headers
                d3.selectAll( '#col-header-rect' ).classed( 'highlightSelected', function( d ) {
                    return selectionEventData.colUid.indexOf( d && d.uid ) !== -1;
                } );
            } else {
                for( var i = 0; i < selectionEventData.rowUid.length; i++ ) {
                    if( selectionEventData.rowUid[ i ] === data.rowUid ) {
                        selectionEventData.rowUid.splice( i, 1 );
                        break;
                    }
                }
                //Deselect row header and only highlight selected row headers
                d3.selectAll( '#row-header-label' ).classed( 'highlightSelected', function( d ) {
                    return selectionEventData.rowUid.indexOf( d && d.uid ) !== -1;
                } );
            }
            d3.select( element.parentNode ).select( 'rect' ).attr( 'id', '' ).classed( 'selected-cell', false );
        }
    }
    selectionEventData.operationType = operationType;
    selectionEventData.isMultipleSelection = isMultipleSelection;
    eventBus.publish( 'Arm0Traceability.showTracelinksPopup', selectionEventData );
};
/**
  * Highlight the row and column of the selected cell
  *
  * @param {object} cell The selected cell
  * @param {object} cellData Link info for the selected cell
  * @param {boolean} update Set cell as the new clicked_cell
  */
export let highlightSelection = function( cell, cellData, update ) {
    // Highlight rows and columns of selected cell.
    d3.selectAll( '.cell' ).classed( 'highlight', function( d ) {
        return d.pos_x === cellData.pos_x || d.pos_y === cellData.pos_y;
    } );
    d3.selectAll( '#row-header-label' ).classed( 'highlight', function( d ) {
        return d.uid === cellData.rowUid;
    } );
    d3.selectAll( '#col-header-rect' ).classed( 'highlight', function( d ) {
        return d.uid === cellData.colUid;
    } );
    //TODO TRACK THIS UPDATE flag
    if( update ) {
        d3.select( '#clicked_cell' ).attr( 'id', '' ).classed( 'selected-cell', false );
        d3.select( cell ).attr( 'id', 'clicked_cell' ).classed( 'selected-cell', true );
    }
};
/**
  * clear highlighting the row and column of the selected cell
  */
export let clearHighlight = function() {
    d3.selectAll( '.highlight' ).classed( 'highlight', false );
    d3.select( '#clicked_cell' ).classed( 'selected-cell', true );
};
/**
  * Update matrix when heatmap mode is toggled (link count shown with color intensity)
  * @param {boolean} showColor true if heatmap mode toggled on
  */
export let showHeatMap = function( showColor ) {
    main_svg.selectAll( '#matrix_cluster.cell' ).classed( 'heated', function( d ) {
        if( d.isColHidden || d.isRowHidden ) {
            return false;
        }
        return d.value > 0 && showColor;
    } )
        .attr( 'opacity', 1 );
    main_svg.selectAll( '#matrix_cluster .heated' ).attr( 'opacity', function( d ) {
        return d.value;
    } );
    // hide cell content in heatmap mode
    main_svg.selectAll( '.g-cell' ).selectAll( 'text,.traceability_icon' ).style( 'opacity', function( d ) {
        if( d.isColHidden || d.isRowHidden ) {
            return 0;
        }
        return showColor ? 0 : 1;
    } );
};

export let hideNumbersFromHeaderOnShowHeatMap = function( showColor ) {
    // hide cell content in heatmap mode
    main_svg.selectAll( '#row_labels .g-cell,#col_labels .g-cell' ).selectAll( 'text' ).style( 'opacity', function( d ) {
        if( d.isColHidden || d.isRowHidden ) {
            return 0;
        }
        return showColor ? 0 : 1;
    } );
};

/**
  * show tl arrows
  * @param {boolean} if true show arrows if false don't show.
  */
export let tracelinkDirectionChangeAction = function( showTracelinkDirection ) {
    d3.selectAll( '.g-cell' ).selectAll( '.traceability_icon' ).style( 'opacity', function( d ) {
        if( showTracelinkDirection === 'false' || showTracelinkDirection === false ||  d.isColHidden || d.isRowHidden ) {
            return 0;
        } else if( showTracelinkDirection === 'true' || showTracelinkDirection === true && ( !d.isColHidden && !d.isRowHidden ) ) {
            return 1;
        }
    } );
};

/**
  * Retain previous selection
  */
export let renderMatrixSelection = function() {
    var cell = appCtxSvc.getCtx( 'Arm0TraceabilityMatrixSelectedCell' );
    if( cell ) {
        if( cell.rowUid ) {
            cell.rowUid = cell.rowUid[ 0 ];
        }
        if( cell.colUid ) {
            cell.colUid = cell.colUid[ 0 ];
        }
        var isMultipleSelection = selectionUids.length > 1;
        var isRow;
        if( lastSelectedCol ) {
            isRow = false;
        } else {
            isRow = true;
        }
        _renderMatrixSelection( cell, isRow, isMultipleSelection, true );
    }
};
/**
  * navigate_click_row
  * @param {object} d Link data for cell
  */
export let navigate_click_row = function( d, thisObject ) {
    rememberScroll();
    // highlight current
    d3.select( thisObject.parentNode ).select( 'text' )
        .attr( 'id', 'clicked_row' );
    if( d.isExpanded ) {
        var eventData = { rowUid: d.uid };
        eventBus.publish( 'Arm0TraceabilityMatrix.collapseNode', eventData );
    } else if( d.isParent ) {
        var rowName = d3.select( thisObject.parentNode ).select( 'text' ).text();
        var rowUid = d.uid;
        var navEventData = { rowName: rowName, rowUid: rowUid, rowPageToNavigate: 1 };
        //this event triggers isNavRequired
        eventBus.publish( 'requirementTraceability.navigateUpOrDown', navEventData );
    }
    var event = { colUid: [ -1 ], rowUid: [ -1 ] };
};
/**
  * navigate_click_col
  * @param {object} d Link data for cell
  */
export let navigate_click_col = function( d, thisObject ) {
    rememberScroll();
    d3.select( '#clicked_col' ).attr( 'id', '' );
    // highlight current
    d3.select( thisObject.parentNode ).select( 'text' )
        .attr( 'id', 'clicked_col' );
    if( d.isExpanded ) {
        var eventData = { colUid: d.uid };
        eventBus.publish( 'Arm0TraceabilityMatrix.collapseNode', eventData );
    } else if( d.isParent ) {
        var colUid = d.uid;
        // Fire an event
        var navEventData = { colUid: colUid, colPageToNavigate: 1 };
        eventBus.publish( 'requirementTraceability.navigateUpOrDown', navEventData );
    }
    var eventData = { colUid: [ -1 ], rowUid: [ -1 ] };
};

const getPadding = () => {
    // getCellCenter
    const cell = d3.event.currentTarget;
    const { width, height } = cell.getBoundingClientRect();
    return { x: -width / 2, y: -height / 2 };
};

/**
  * Invokes popup for tooltip on hidden object and popup to show list of hidden objects
  * @param {object} d Link data for cell
  * @param {object} hiddenObjectsPopupData data to render popup
  */
export let render_popup = function( d, hiddenObjectsPopupData ) {
    var popupData = {
        declView: hiddenObjectsPopupData.declView,
        options: {
            whenParentScrolls: 'close',
            placement: hiddenObjectsPopupData.placement,
            reference: d3.event.currentTarget,
            padding: getPadding(),
            autoFocus: true,
            hasArrow: true,
            draggable: false,
            width: hiddenObjectsPopupData.width,
            clickOutsideToClose: true,
            forceCloseOthers: false,
            arrowOptions: {
                alignment: 'center',
                offset: 5,
                shift: 15
            },
            subPanelContext: {
                eventData: d
            }
        }
    };
    popupService.show( popupData ).then( function( popupRef ) {
        if( hiddenObjectsPopupData.isTooltip ) {
            _popupRefHiddenObjectTooltip = popupRef;
        } else {
            _popupRefClickMenuHideUnhide = popupRef;
        }

        _loadingTracelinkPopup = false;
    } );
};

/**
  * Invokes popup for context click on hidden object
  */
export let invokeContextMenuPopup = function() {
    var element = d3.event.currentTarget ? d3.event.currentTarget : d3.event.srcElement;

    if( element.className.animVal === 'col_label' ) {
        element = element.getElementsByClassName( 'aw-relationshipmatrix-headerText' )[ 0 ];
    }
    if( element.className.animVal === 'row_label_text' ) {
        element = element.getElementsByClassName( 'aw-widgets-propertyNonEditRect matrix_header_background' )[ 0 ];
    }

    var popupData = {
        declView: 'Arm0TraceMatrixContextMenuHideUnhide',
        options: {
            whenParentScrolls: 'close',
            placement: 'right',
            reference: element,
            padding: getPadding(),
            autoFocus: true,
            clickOutsideToClose: true,
            forceCloseOthers: false,
            draggable: false
        }
    };
    popupService.show( popupData ).then( function( popupRef ) {
        //Close if context menu popup is open
        if( _popupRefContextMenuHideUnhide ) {
            popupService.hide( _popupRefContextMenuHideUnhide );
            _popupRefContextMenuHideUnhide = null;
        }
        //close if hidden list popup is open
        if( _popupRefClickMenuHideUnhide ) {
            popupService.hide( _popupRefClickMenuHideUnhide );
            _popupRefClickMenuHideUnhide = null;
        }
        _popupRefContextMenuHideUnhide = popupRef;
    } );
};

/**
  * Invokes function to unhide all from selected
  */
export let invokeUnhideAllFromSelected = function() {
    var matrixContext = appCtxSvc.getCtx( 'MatrixContext' );
    var isRow = matrixContext.isRowSelected;
    var eventData = {
        unhideObjects: [],
        isRow: isRow
    };
    for( var i = 0; i < selectionUids.length; i++ ) {
        eventData.unhideObjects.push( selectionUids[ i ] );
    }
    eventBus.publish( 'Arm0Traceability.UnhideAllFromSelected', eventData );
};
/**
  * remember scroll state other because it gets lost after refresh
  */
export let rememberScroll = function() {
    var mtx = d3.select( '#aw-traceability-matrix-widget' ).node().parentNode;
    scrollX = mtx.scrollLeft;
    scrollY = mtx.scrollTop;
};
/**
  * timeout_resize
  */
export let timeout_resize = function() {
    // clear timeout
    clearTimeout( doit );
    doit = setTimeout( self.reset_visualization_size, 500 );
};
/**
  * showEmptyRowsandCols
  */
export let showEmptyRowsandCols = function() {};
/**
  * reset_visualization_size
  */
export let reset_visualization_size = function() {
    self.set_visualization_size();
    // pass the network data to d3_clustergram
    refreshMatrix( global_network_data );
    // reselect the selected cell
    if( selectedCell ) {
        d3.select( '.' + selectedCell )
            .attr( 'id', 'clicked_cell' )
            .classed( 'selected-cell', true );
    }
};
/**
  * reorder_click_row
  */
export let reorder_click_row = function( d ) {
    d3.select( '#clicked_row' ).attr( 'id', '' );
    d3.selectAll( '#row_text_and_buttons' ).classed( 'sorted', false );
    d3.select( this.parentNode ).classed( 'sorted', true );
    d3.selectAll( '.row_label_text .aw-relationshipmatrix-sortControl ' ).each( add_sortIconRow_function );
    // highlight current
    d3.select( this.parentNode ).select( 'text' )
        .attr( 'id', 'clicked_row' );
    if( d.rowUid !== '' ) {
        d.uid = d.rowUid;
    }else{
        d.uid = d.colUid;
    }
    var eventData = {
        sortCol: d.uid === '' ? 'total' : d.uid
    };
    sortedRowUID = d.uid === '' ? 'total' : d.uid;
    invokeSortPopupOnTraceMat( eventData );
};
/**
  * reorder_click_col
  */
export let reorder_click_col = function( d ) {
    var inst_term = d3.select( this.parentNode ).select( 'text' ).attr( 'full_name' );
    d3.select( '#clicked_col' ).attr( 'id', '' );
    d3.selectAll( '.col_label' ).classed( 'sorted', false );
    d3.selectAll( '.col_label_text' ).classed( 'sorted', false );
    d3.select( this.parentNode ).classed( 'sorted', true );
    d3.selectAll( '.col_label .aw-relationshipmatrix-sortControl' ).each( add_sortIconCol_function );
    // highlight current
    d3.select( this.parentNode ).select( 'text' )
        .attr( 'id', 'clicked_col' );
    if( d.rowUid !== '' ) {
        d.uid = d.rowUid;
    }else{
        d.uid = d.colUid;
    }
    var eventData = {
        sortRow: d.uid === '' ? 'total' : d.uid
    };
    sortedColUID = d.uid === '' ? 'total' : d.uid;
    invokeSortPopupOnTraceMat( eventData );
};
/**
  * get_row_count
  */
export let get_row_count = function() {
    return row_nodes.length;
};
/**
  * get_col_count
  */
export let get_col_count = function() {
    return col_nodes.length;
};
/**
  * get_default_view
  * test helper: returns true if treemode and false if listmode.
  * TODO: replace bools for strings.
  */
export let get_default_view = function() {
    return treeMode;
};
/**
  * get_network_data
  * test helper: returns the current network data to verify things are in good shape.
  */
export let get_network_data = function() {
    return network_data;
};

/**
  * Reset scroll variables,coordinates of polygon at the rest action
  */
export let resetCachedCoordsOfMatrixContainer = () => {
    scrollLeft = 0;
    scrollTop = 0;
    max_row_width = 200;
    max_col_width = 200;
    wrapperPolygonCoordinates = '260,27 433,27 260,200';
    isSpliiterDragged = false;
    sortedRowUID = null;
    sortedColUID = null;
    // Resest max row/col chars allowed
    max_row_text = 20;
    max_row_title_text = 25;
    max_col_text = 24;
};

const exports = {
    refreshMatrix,
    getIcon,
    tracelinkDeleted,
    setPageInfo,
    resetPageInfo,
    getRevisionObject,
    make_d3_clustergram,
    set_visualization_size,
    deteleTracelinkFromMap,
    calculateViewerHeight,
    prefFilter,
    paginationHandle,
    setCurrent,
    redirectToNextPrevPage,
    nextRowPageNavigation,
    previousColPageNavigation,
    nextColPageNavigation,
    collNavigationUp,
    rowNavigationUp,
    add_col_indent_lines,
    add_row_indent_lines,
    add_chevronIcon_function,
    getIndent,
    add_tracelinkIcon_function,
    add_sortIconRow_function,
    add_typeIcon_function,
    row_function,
    handleCellSelection,
    highlightSelection,
    reset_visualization_size,
    showHeatMap,
    showEmptyRowsandCols,
    tracelinkDirectionChangeAction,
    reorder_click_row,
    reorder_click_col,
    navigate_click_col,
    rememberScroll,
    navigate_click_row,
    timeout_resize,
    clearHighlight,
    get_row_count,
    get_col_count,
    get_default_view,
    get_network_data,
    resetCachedCoordsOfMatrixContainer,
    handleRowSelection,
    renderMatrixSelection,
    render_popup,
    invokeUnhideAllFromSelected,
    _handleUnselection,
    resizeMatrix
};
export default exports;

