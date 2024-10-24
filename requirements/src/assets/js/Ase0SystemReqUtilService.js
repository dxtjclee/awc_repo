// Copyright (c) 2022 Siemens

/**
 * @module js/Ase0SystemReqUtilService
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';

var exports = {};

const SPLM_TABLE_ELEMENT = 'aw-splm-table';

/**
 * Address sash movement from PWA
 *
 * @param {Object} area1 left side of the slider
 * @param {Object} area2 right side of the slider
 */
function handleAceSlider( area1, area2 ) {
    var width = area1.parentElement.clientWidth - area1.clientWidth - 20;

    var elements = area2.getElementsByClassName( 'aw-layout-panelMain' );

    if( elements.length > 0 ) {
        var tableStyle = elements[ 0 ].getAttribute( 'style' );
        if( tableStyle === null ) { tableStyle = ''; }

        tableStyle = exports.updateOrAddMaxWidthStyle( tableStyle, width );

        elements[ 0 ].setAttribute( 'style', tableStyle );
    }
}

/**
 * Find the attributes table
 *
 * @param {*} area1 left side of the slider
 * @param {*} area2 right side of the slider
 * @returns {Object} attribute table element or null
 */
function findAttributesTable( area1, area2 ) {
    let attTable = null;
    let gridid = null;
    let tables = area2.getElementsByTagName( SPLM_TABLE_ELEMENT );
    if( tables.length > 0 ) {
        gridid = tables[ 0 ].getAttribute( 'gridid' );
        if( gridid && gridid === 'mappedAttrTable' ) {
            attTable = tables[ 0 ];
        }
    } else {
        var bottomRow = area1.parentElement.parentElement.children[ 2 ];
        tables = null;
        if( bottomRow ) {
            tables = bottomRow.getElementsByTagName( SPLM_TABLE_ELEMENT );
        }
        if( tables && tables.length > 0 ) {
            gridid = tables[ 0 ].getAttribute( 'gridid' );
            if( gridid && gridid === 'mappedAttrTable' ) {
                attTable = tables[ 0 ];
            }
        }
    }
    return attTable;
}

/**
 * fixAttMapTableHeight
 */
export let fixAttMapTableHeight = function() {
    var attMapTable = document.getElementsByTagName( 'aw-am-table-panel' );

    if( attMapTable && attMapTable.length > 0 ) {
        var totalHeight = 0;

        var areas = document.getElementsByTagName( 'aw-occmgmt-secondary-workarea' );
        if( areas.length > 0 ) {
            totalHeight = areas[ 0 ].clientHeight - 60; // subtract tab list height
        }

        if( totalHeight > 0 ) {
            var elements = document.getElementsByName( 'Ase0SystemRequirements' );
            var splitters = elements[ 0 ].getElementsByClassName( 'aw-layout-splitter' );

            var topRow = splitters[ 1 ].previousElementSibling;
            var bottomRowHeight = totalHeight - topRow.clientHeight - 110;

            var attMapStyle = attMapTable[ 0 ].getAttribute( 'style' );
            if( attMapStyle === null ) {
                attMapStyle = '';
            }

            attMapStyle = exports.updateOrAddHeightStyle( attMapStyle, bottomRowHeight );
            attMapTable[ 0 ].setAttribute( 'style', attMapStyle );
        }
    }
};


/**
 * Define various table heights based on visibility
 *
 * @param {*} area1 left side of slider
 * @param {*} reqTable requirement table element
 * @param {*} viewerVis flag for viewer visibility
 * @param {*} viewer viewer element
 * @param {*} attTableVis attribute table visibility
 * @param {*} attTable attribute table element
 * @returns {Object} new context for panels
 */
function defineTableHeights( area1, reqTable, viewerVis, viewer, attTableVis, attTable ) {
    let reqCtx = {};
    if( reqTable && viewerVis ) {
        var totalWidth = reqTable.clientWidth + viewer.clientWidth + 20; // 20 is splitter size

        var proportion = Math.floor( reqTable.clientWidth / totalWidth * 100 );

        // Column takes an integer (N) that is a proportion of 12.
        proportion = reqTable.clientWidth / totalWidth * 13.0; // (* magic 13 works better then 12)

        reqCtx.tableWidthProprtion = proportion.toString();

        if( attTableVis ) {
            reqCtx.tableHeight = reqTable.clientHeight;
            reqCtx.viewerHeight = viewer.clientHeight;
        }
    }

    if( attTableVis ) {
        var rowTable = attTable.parentElement.parentElement.parentElement;

        var totalHeight = rowTable.parentElement.parentElement.clientHeight;
        proportion = Math.floor( totalHeight / 12 );

        // Row takes an integer (N) that is a proportion of 12.
        var topRowProportion = Math.floor( rowTable.children[ 0 ].clientHeight / 12 );
        var bottomRowProportion = proportion - topRowProportion;

        reqCtx.topRowProportion = bottomRowProportion.toString() - 4 + 'f';
        reqCtx.bottomRowProportion = topRowProportion.toString() + 'f';

        // if adjusting rows the heights will need corrected
        if( area1 === rowTable.children[ 0 ] ) {
            // need to adjust heights of tables

            // Requirements Table
            let tableStyle = reqTable.parentElement.getAttribute( 'style' );
            if( tableStyle === null ) { tableStyle = ''; }

            tableStyle = exports.updateOrAddHeightStyle( tableStyle, rowTable.children[ 0 ].clientHeight );

            reqTable.parentElement.setAttribute( 'style', tableStyle );

            // Doc viewer
            tableStyle = viewer.parentElement.parentElement.getAttribute( 'style' );
            if( tableStyle === null ) { tableStyle = ''; }

            tableStyle = exports.updateOrAddHeightStyle( tableStyle, rowTable.children[ 0 ].clientHeight );

            viewer.parentElement.parentElement.setAttribute( 'style', tableStyle );

            // attributes table
            tableStyle = attTable.parentElement.parentElement.parentElement.getAttribute( 'style' );
            if( tableStyle === null ) { tableStyle = ''; }

            if( rowTable.children.length > 1 ) {
                tableStyle = exports.updateOrAddHeightStyle(
                    tableStyle, rowTable.children[ 2 ].clientHeight - 50 );

                attTable.parentElement.parentElement.parentElement.setAttribute( 'style', tableStyle );
            }

            var attMapTable = document.getElementsByTagName( 'aw-am-table-panel' );

            if( attMapTable ) {
                var attMapStyle = '';
                attMapTable[ 0 ].setAttribute( 'style', attMapStyle );
            }
        }
    }
    return reqCtx;
}

/**
 * returns the UIDs of objects represented by the proxy object
 * @param {String} proxyUid the recipe of Ase0TracelinkRelationProxy object
 * @returns {Object} object with recipe split up
 */
export let splitRecipe = function( proxyUid ) {
    var _recipeSplit = proxyUid.split( /(AWB[CI]B:)/ );
    var _selectedUid = null;
    var _relatedUid = null;
    var _relationUid = null;
    var _relationType = null;
    if( _recipeSplit && _recipeSplit.length && _recipeSplit.length === 5 ) {
        var _token = _recipeSplit[ 0 ];
        _token = _token.substring( 'SR::N::Ase0TracelinkRelationProxy..'.length );
        _relationType = _token.substring( 0, _token.indexOf( ':' ) );
        _selectedUid = 'SR::N::' + _token.substring( _token.indexOf( ':' ) + 1 ) + _recipeSplit[ 1 ].replace( ':', '' );
        _relationUid = _recipeSplit[ 4 ];
        _relatedUid = 'SR::N::' + _recipeSplit[ 2 ] + _recipeSplit[ 3 ].replace( ':', '' );
    }
    return {
        selectedUid: _selectedUid,
        relatedUid: _relatedUid,
        relationUid: _relationUid,
        relationType: _relationType
    };
};

/**
 * returns if the string has a specific suffix
 * @param {String} str input string
 * @param {String} suffix input suffix
 * @returns {Boolean} true if the str ends with suffix
 */
export let stringEndsWith = function( str, suffix ) {
    return str.indexOf( suffix, str.length - suffix.length ) !== -1;
};

/**
 * Modifies the style with new height attribute
 *
 * @param {String} style style attribute
 * @param {String} height new height to be set
 * @returns {String} modified style
 */
export let updateOrAddHeightStyle = function( style, height ) {
    var n = style.search( /(height: )\d+(px)/ );
    if( n !== -1 ) {
        style = style.replace( /(height: )\d+(px)/, 'height: ' + height.toString() + 'px' );
    } else {
        style += 'height: ' + height.toString() + 'px; ';
    }

    return style;
};

/**
 * returns updated style string with width attribute
 * @param {String} style input style
 * @param {Object} width input width
 * @returns {String} updated style
 */
export let updateOrAddMaxWidthStyle = function( style, width ) {
    var n = style.search( /(max-width: )\d+(px)/ );
    if( n !== -1 ) {
        style = style.replace( /(max-width: )\d+(px)/, 'max-width: ' + width.toString() + 'px' );
    } else {
        style += 'max-width: ' + width.toString() + 'px; ';
    }

    return style;
};

/**
 * The method updates various panel sizes
 *
 * @param {Object} eventData event data
 * @returns {Object} context to update
 */
export let updatePanelSizes = function( eventData ) {
    return null;

};

/**
 * updates the property policy
 * @param {Object} policy input policy
 * @param {String} propertyName property name
 */
export let updatePolicy = function( policy, propertyName ) {
    // Add propertyName to policy
    if( propertyName.indexOf( 'REF' ) === 0 ) {
        var type = propertyName.substring( propertyName.indexOf( ',' ) + 1, propertyName.indexOf( ')' ) );
        var property = propertyName.substring( propertyName.indexOf( '.' ) + 1 );

        var data = {
            name: type,
            properties: [ { name: property } ]
        };

        policy.types.push( data );
    }
};

/**
 * Prepare input for delete trace link
 * @return {*} deleteObjects soa input
 */
export let prepareDeleteRequirementTracelinkInput = function() {
    var input = [];
    var sysReqSelection = appCtxSvc.getCtx( 'Ase0SystemRequirementsSelection.selection' );
    if( sysReqSelection && sysReqSelection.length > 0 ) {
        _.forEach( sysReqSelection, function( proxyObject ) {
            if( proxyObject && proxyObject.type === 'Ase0TracelinkRelationProxy' && proxyObject.props && proxyObject.props.ase0RelationElement ) {
                var relationObject = cdm.getObject( proxyObject.props.ase0RelationElement.dbValues[ 0 ] );
                if( relationObject ) {
                    input.push( relationObject );
                }
            }
        } );
    }
    return input;
};

/**
 * Update Requirements Tree on Delete trace link event
 *@param{Object} eventData data from event
 *@param{Object} dataProvider data provided object
 */
export let updateRequirementsTreeViewOnDelete = function( eventData, dataProvider ) {
    var doRefresh = false;

    if( eventData && eventData.deletedObjectUids && dataProvider && dataProvider.viewModelCollection.totalFound > 0 ) {
        var deletedObjectUids = eventData.deletedObjectUids;
        doRefresh = _areAnyDeletedObjsTraceLinkType( deletedObjectUids, dataProvider.viewModelCollection.loadedVMObjects );
    }
    if( doRefresh ) {
        reloadRequirementsTreeView( dataProvider );
    }
};

/**
 * reloadRequirementsTreeView
 *@param{Object} dataProvider data provided object
 */
export let reloadRequirementsTreeView = function( dataProvider ) {
    if( dataProvider ) {
        dataProvider.viewModelCollection.clear();
        eventBus.publish( 'RequirementsTree.plTable.reload' );
    }
};

/**
 * _areAnyDeletedObjsTraceLinkType
 * @param {*} deletedObjectUids deletedObjectUids
 * @param {*} selectedObjects selectedObjects
 * @return {*} true if tracelink is deleted
 */
function _areAnyDeletedObjsTraceLinkType( deletedObjectUids, selectedObjects ) {
    var isTraceLinkType = false;
    if( deletedObjectUids && selectedObjects && selectedObjects.length > 0 ) {
        _.forEach( deletedObjectUids, function( deletedObjectUid ) {
            _.forEach( selectedObjects, function( selectedObject ) {
                if( selectedObject.props.ase0RelationElement.dbValue === deletedObjectUid ) {
                    isTraceLinkType = true;
                    return false;
                }
            } );
        } );
    }
    return isTraceLinkType;
}

/**
 * process for partial errors
 * @param {*} serviceData deletedObjectUids
 * @return {*} message object to display
 */
export let processPartialErrors = function( serviceData ) {
    var name = [];
    var msgObj = {
        name: '',
        msg: '',
        level: 0
    };

    if( serviceData.partialErrors && appCtxSvc.ctx.mselected.length === 1 ) {
        name.push( appCtxSvc.ctx.mselected[ 0 ].props.object_name.dbValues[ 0 ] );
        msgObj.name += name[ 0 ];
        for( var x = 0; x < serviceData.partialErrors[ 0 ].errorValues.length; x++ ) {
            msgObj.msg += '<BR/>';
            msgObj.msg += serviceData.partialErrors[ 0 ].errorValues[ x ].message;
        }
        msgObj.level = _.max( [ msgObj.level, serviceData.partialErrors[ 0 ].errorValues[ 0 ].level ] );
    }

    return msgObj;
};

export default exports = {
    fixAttMapTableHeight,
    splitRecipe,
    stringEndsWith,
    updateOrAddHeightStyle,
    updateOrAddMaxWidthStyle,
    updatePanelSizes,
    updatePolicy,
    prepareDeleteRequirementTracelinkInput,
    updateRequirementsTreeViewOnDelete,
    reloadRequirementsTreeView,
    processPartialErrors
};
