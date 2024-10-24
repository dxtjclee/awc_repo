// Copyright (c) 2022 Siemens

/* *
 * @module js/Att1CellRenderingService
 */
import appCtxSvc from 'js/appCtxService';
import preferenceService from 'soa/preferenceService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import localeService from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import tableSvc from 'js/published/splmTablePublishedService';
import htmlUtil from 'js/htmlUtils';

var exports = {};

var isCompareModeOn = false;
var compareColumns = [];
var OBJECT_NAME_COLUMN = 'REF(att1SourceAttribute,Att0MeasurableAttribute).object_name';
var MEASUREMENT_COLUMN_NAME = 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0CurrentValue,Att0MeasureValueDbl).att0Value';
var GOAL_COLUMN_NAME = 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Goal';
var MIN_COLUMN_NAME = 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Min';
var MAX_COLUMN_NAME = 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Max';
var columnsToShowHyperlinks = [ MEASUREMENT_COLUMN_NAME, GOAL_COLUMN_NAME, MIN_COLUMN_NAME, MAX_COLUMN_NAME ];
let resource = 'Att1AttrMappingMessages';
let localeTextBundle = localeService.getLoadedText( resource );
/**
 * parentUid: struct {
 *      sourceElements      : {columnName:element}  // div elements corresponding to the source parameters
 *      childFirstElem      : {childUid:element}    // div elements corresponding to the child parameters
 *      hasDifference       : Boolean               // true if there's a difference between source and child parameter values,
 *      hasMissingParameters: Boolean               // true if the source parameter has missing parameter(s)
 * }
 *
 */
var parentToCompareInfo = new Map();
var uidToVMNodeMap = new Map();

/**
 * Set background color for source parameters
 */
let _showBackgroundForSourceRender = () => {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
            rowElem.classList.add( 'aw-attrtargetmgmt-sourceRow' );
            return cellContent;
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            return isCompareModeOn === true && vmo.levelNdx === 0;
        }
    };
};

/**
 * Cell Renderer to set the hyperlink style to measurement column if parameter contains complex data
 * @returns {Element} the dom element containing the text with hyperlink style
 */
let hyperlinkCellRenderer = () => {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
            if( vmo.props && vmo.props.att1SourceAttribute ) {
                var sourceAttr = vmo.props.att1SourceAttribute.dbValue;
                if( sourceAttr ) {
                    var attribute = cdm.getObject( sourceAttr );
                    if( attribute ) {
                        if( attribute.props && attribute.props.att0AttributeTable ) {
                            var dbValues = attribute.props.att0AttributeTable.dbValues;
                            if( dbValues && dbValues.length > 0 && dbValues[ 0 ] !== null && dbValues[ 0 ] !== '' ) {
                                cellContent.setAttribute( 'style', 'cursor:pointer;color:#197FA2;' );
                                if( column.propertyName === MEASUREMENT_COLUMN_NAME ) {
                                    cellContent.classList.add( 'aw-attrtargetmgmt-measurementColumn' );
                                }

                                // Add click event to open the Parameters wide panel
                                cellContent.addEventListener( 'click', function( event ) {
                                    if( event.ctrlKey  === false ) {
                                    // Open Parameters Wide Panel
                                        if( this.classList.contains( 'aw-attrtargetmgmt-measurementColumn' ) ) {
                                            eventBus.publish( 'uniformParamTable.selectionChangeEvent' );
                                            callEventAfterTimeout( 'uniformParamTable.openParameterWidePanel', { isShowMeasurementTab: true } );
                                        } else {
                                            eventBus.publish( 'uniformParamTable.selectionChangeEvent' );
                                            callEventAfterTimeout( 'uniformParamTable.openParameterWidePanel' );
                                        }
                                    }
                                } );
                            }
                        }
                    }
                }
            }
            return cellContent;
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            var ctx = appCtxSvc.ctx;
            var isMajorReleaseGreaterThen13 = ctx.tcSessionData.tcMajorVersion > 13;
            var isMinimun133Release = ctx.tcSessionData.tcMajorVersion === 13 && ctx.tcSessionData.tcMinorVersion >= 3;
            var isValidRelease = isMajorReleaseGreaterThen13 || isMinimun133Release;
            return columnsToShowHyperlinks.indexOf( column.propertyName ) > -1 && isValidRelease;
        }
    };
};

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
 * Highlights the differences in cell Values
 */
let _showDifferenceRender = () => {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
            var columnName = column.propertyName;
            var parentNode = uidToVMNodeMap.get(  vmo.parentVmNode );

            if( vmo.levelNdx === 0 ) {
                // initialise structure for parent information
                if( !( parentToCompareInfo && parentToCompareInfo.get( vmo.uid ) ) ) {
                    var struct = {
                        sourceElements: new Map(),
                        childFirstElem: new Map(),
                        vmo: null,
                        hasDifference: false,
                        hasMissingParameters: false
                    };
                    parentToCompareInfo.set( vmo.uid, struct );
                }
                parentToCompareInfo.get( vmo.uid ).sourceElements.set( columnName, cellContent );
                // When the source node is collapsed and there's a difference in values with child parameters
                // We need to show the red indicator

                var isNoChildren = !vmo.childVmNodes || vmo.childVmNodes && vmo.childVmNodes.length === 0;
                if( !isNoChildren ) {
                    var indicatorDetails = getIndicatorForSourceRow( vmo, vmo.childVmNodes, columnName, cellContent );
                    if( indicatorDetails.showYellowIndicator === false && indicatorDetails.showRedIndicator === true ) {
                        showRedIndicator( [ parentToCompareInfo.get( vmo.uid ).sourceElements.get( OBJECT_NAME_COLUMN ) ] );
                    } else if( indicatorDetails.showYellowIndicator === true && indicatorDetails.showRedIndicator === false ) {
                        showYellowIndicator( [ parentToCompareInfo.get( vmo.uid ).sourceElements.get( OBJECT_NAME_COLUMN ) ] );
                    }
                }
            } else if( vmo.levelNdx === 1 && parentNode &&  parentNode.isExpanded && parentNode.isExpanded === true && vmo.props ) {
                var parentStruct = parentToCompareInfo.get( parentNode.uid );
                if( parentStruct && columnName === OBJECT_NAME_COLUMN ) {
                    parentStruct.childFirstElem.set( vmo.uid, cellContent );
                    parentToCompareInfo.get( parentNode.uid ).vmo = parentNode;
                    if( vmo.isDummy === true ) {
                        // Show Yellow Indicator on name column of Source and Current parameter
                        parentToCompareInfo.get( parentNode.uid ).hasMissingParameters = true;
                        parentNode.isExpanded = true;
                        var currentNameColumn = parentToCompareInfo.get( parentNode.uid ).childFirstElem.get( vmo.uid );
                        var sourceNameColumn = parentToCompareInfo.get( parentNode.uid ).sourceElements.get( OBJECT_NAME_COLUMN );
                        showYellowIndicator( [ currentNameColumn, sourceNameColumn ] );
                        var iconURL = parentNode.iconURL;
                        setAttributeIconToDummyParameter( cellContent, iconURL );
                    }
                }
                // Find value difference
                if( vmo.isDummy === false && vmo.props[ columnName ] !== undefined && compareColumns.indexOf( columnName ) > -1 ) {
                    var propValue = getPropValueForVMO( vmo, columnName );
                    if( parentNode && parentNode.props && parentNode.props[ columnName ] ) {
                        var parentPropValue = getPropValueForVMO( parentNode, columnName );
                        var hasDifference = hasValueDifference( parentPropValue, propValue );
                        if( hasDifference ) {
                            // Highlight differences in both source and current parameter
                            var sourceColumnValue = parentToCompareInfo.get( parentNode.uid ).sourceElements.get( columnName );
                            highlightValueDifference( [ cellContent, sourceColumnValue ] );
                            parentToCompareInfo.get( parentNode.uid ).hasDifference = true;
                            parentNode.isExpanded = true;

                            // Show Red Indicator on name column of Source and Current parameter
                            var currentNameColumn = parentToCompareInfo.get( parentNode.uid ).childFirstElem.get( vmo.uid );
                            var sourceNameColumn = parentToCompareInfo.get( parentNode.uid ).sourceElements.get( OBJECT_NAME_COLUMN );
                            showRedIndicator( [ currentNameColumn, sourceNameColumn ] );
                        }
                    }
                }
            }
            return cellContent;
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            return isCompareModeOn === true && ( compareColumns.indexOf( column.propertyName ) > -1 || column.propertyName === OBJECT_NAME_COLUMN );
        }
    };
};

/**
 * Set background color for source parameters
 */
let _att1ResultCellRenderer = () => {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            var result;
            var resultForCrt0Result;
            if( vmo.props && vmo.props.att1Result && vmo.props.att1Result.dbValue ) {
                result = vmo.props.att1Result.dbValue;
            }
            var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
            var color = document.createElement( 'div' );
            color.style.backgroundSize = '500px 500px';
            color.style.position = 'absolute';
            var colorSrc = null;
            if( result === '100' ) {
                color.innerHTML = vmo.props.att1Result.displayValues[ 0 ];
                colorSrc = '#DC0000';
                color.style.width = '43px';
                color.style.textAlign = 'center';
                color.style.color = 'white';
            } else if( result === '200' ) {
                color.innerHTML = vmo.props.att1Result.displayValues[ 0 ];
                colorSrc = '#0A9B00';
                color.style.width = '43px';
                color.style.textAlign = 'center';
                color.style.color = 'white';
            }
            color.style.backgroundColor = colorSrc;

            cellContent.appendChild( color );
            return cellContent;
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            var columnName = column.propertyName;
            var ctx = appCtxSvc.ctx;
            var isMajorReleaseGreaterThen13 = ctx.tcSessionData.tcMajorVersion > 13;
            var isMinimun133Release = ctx.tcSessionData.tcMajorVersion === 13 && ctx.tcSessionData.tcMinorVersion >= 3;
            var isValidRelease = isMajorReleaseGreaterThen13 || isMinimun133Release;
            var isInContextOfVR = false;
            var contextObject = vmo.props && vmo.props.att1AttrContext && vmo.props.att1AttrContext.dbValue;
            if( contextObject ) {
                var attrContextModelObject = cdm.getObject( contextObject );
                if( attrContextModelObject && attrContextModelObject.modelType && attrContextModelObject.modelType.typeHierarchyArray.indexOf( 'Crt0AttributeElement' ) > -1 ) {
                    isInContextOfVR = true;
                }
            }

            return columnName === 'att1Result' && isInContextOfVR === false && isValidRelease;
        }
    };
};

/**
 * Gets the required text once
 * @param {Object} key - i18n key
 * @return {Object} - i18n text
 */
let _get18nText = function( key ) {
    const localeTextBundle = localeService.getLoadedText( 'Att1AttrMappingMessages' );
    return localeTextBundle[ key ];
};

/**
 * Gets the required and autogenerated custom renderer
 * @return {Object} - cell content
 */
let _getEditRequiredCellRenderers = function() {
    return {
        action: function( column, vmo, tableElem ) {
            // Add 'required' only if no content
            // as soon as we get content, remove it
            if( vmo.props[ column.propertyName ] && ( vmo.props[ column.propertyName ].dbValue === null || vmo.props[ column.propertyName ].dbValue === '' )
                && column.index > 0 ) {
                let cellContent = tableSvc.createElement( column, vmo, tableElem );
                var gridCellText = htmlUtil.createElement( 'div', tableSvc.CLASS_WIDGET_TABLE_CELL_TEXT );
                cellContent.classList.add( tableSvc.CLASS_TABLE_CELL_TOP_DYNAMIC );
                cellContent.classList.add( 'aw-requiredIcon' );
                // mimic the input placeholder for input and text area
                gridCellText.textContent = _get18nText( 'required' );
                gridCellText.classList.add( 'aw-requiredText' );
                cellContent.prepend( gridCellText );
                return cellContent;
            }
        },
        condition: function( column, vmo ) {
            if( !vmo || !column || !vmo.isInlineRow || !vmo.isEditing || !vmo.props[ column.propertyName ] || !vmo.props[ column.propertyName ].isRequired ) {
                return false;
            }
            // If Data Type or Parameter Definition is changed then fire event to update GMM fields for new type
            let propertyName = column.propertyName.split( '.' ).slice( -1 )[0];
            if ( propertyName === 'att0AttrType' && vmo.props[ column.propertyName ].dbValue !== vmo.targetObjectType ) {
                var eventData = {
                    uid: vmo.uid,
                    newType: vmo.props[ column.propertyName ].dbValue
                };
                eventBus.publish( 'Att1ShowParametersTable.updateDataTypeForInlineParameter', eventData );
            }
            if ( column.propertyName === 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0AttrDefRev,Att0AttributeDefRevision).object_name'
                && vmo.props[ column.propertyName ].dbValue !== vmo.props[ column.propertyName ].dbValues[0] && vmo.props[ column.propertyName ].dbValue !== null ) {
                var eventData = {
                    vmo: vmo,
                    dataType: vmo.props[ column.propertyName ].dbValue
                };
                eventBus.publish( 'Att1InlineAuthoring.updateGMMForSelectedParam', eventData );
            }
            return true;
        },
        name: 'Att1RequiredCellCustomRenderer'
    };
};

/**
 * Method to set the attibute icon when indicators are getting updated
 * @param {Element} cellContent theh cell content element
 * @param {*} iconURL the icon url to set
 */
function setAttributeIconToDummyParameter( cellContent, iconURL ) {
    var iconDivElement = cellContent.getElementsByClassName( 'aw-widgets-dataGridCellImage' );
    if( iconDivElement ) {
        iconDivElement = iconDivElement[ 0 ];
        var imageElement = iconDivElement.getElementsByTagName( 'img' );
        if( imageElement ) {
            imageElement = imageElement[ 0 ];
            imageElement.setAttribute( 'src', iconURL );
        }
    }
}

/**
 * This method identifies which indicator to show on souce nod edepending on the values difference
 * @param {ViewModelObject} vmo the source parameter view model object
 * @param {Array} childVmNodes the childeren vm nodes of the source parameter
 * @param {String} columnName the name of the column to compare
 * @param {Element} cellContent the DOM element which contains the content of cell
 * @returns {JSON} the json containing which indicator to show
 */
function getIndicatorForSourceRow( vmo, childVmNodes, columnName, cellContent ) {
    var indicatorDetails = {};
    if( vmo && vmo.isDummy === false && vmo.props && vmo.props[ columnName ] !== undefined && compareColumns.indexOf( columnName ) > -1 ) {
        if( childVmNodes ) {
            var propValue = getPropValueForVMO( vmo, columnName );
            for( var i = 0; i < childVmNodes.length; i++ ) {
                if( childVmNodes[ i ] && childVmNodes[ i ].props && childVmNodes[ i ].props[ columnName ] ) {
                    var ChildPropValue = getPropValueForVMO( childVmNodes[ i ], columnName );
                    if( childVmNodes[ i ].isDummy ) {
                        indicatorDetails.showYellowIndicator = true;
                        indicatorDetails.showRedIndicator = false;
                    } else {
                        var hasDifference = hasValueDifference( propValue, ChildPropValue );
                        if( hasDifference ) {
                            var sourceColumnValue = parentToCompareInfo.get( vmo.uid ).sourceElements.get( columnName );
                            highlightValueDifference( [ cellContent, sourceColumnValue ] );
                            indicatorDetails.showRedIndicator = true;
                            indicatorDetails.showYellowIndicator = false;
                            break;
                        }
                    }
                }
            }
        }
    }
    return indicatorDetails;
}

/**
 * Method to find wheter parent or child value have any difference
 * @param {String} parentValue the value of parent cell
 * @param {String} childValue the value of child cell
 * @returns {Boolean} true if value is different otherwise false
 */
function hasValueDifference( parentValue, childValue ) {
    var parentValueEmptyAndNotChild = childValue !== null && childValue && !parentValue;
    var childValueEmptyAndNotParent = parentValue !== null && parentValue && !childValue;
    var bothValuesNotEmptyAndDifferent = childValue !== null && parentValue && parentValue !== null && childValue && parentValue !== childValue;
    if( parentValueEmptyAndNotChild || childValueEmptyAndNotParent || bothValuesNotEmptyAndDifferent ) {
        return true;
    }
    return false;
}

/**
 * Method to get property value for a vmo, In case of GMM and measurement column of parameter with complex data
 * we need to compare att1TablesHashValue property for respective column
 * @param {ViewModelObject} vmo the source parameter view model object
 * @param {String} columnName the name of the column to compare
 * @returns {String} property value to be compared
 */
function getPropValueForVMO( vmo, columnName ) {
    var propValue = '';
    if( columnsToShowHyperlinks.indexOf( columnName ) > -1 && vmo.props && vmo.props.att1SourceAttribute ) {
        var sourceAttr = vmo.props.att1SourceAttribute.dbValue;
        if( sourceAttr ) {
            var attribute = cdm.getObject( sourceAttr );
            if( attribute ) {
                if( attribute.props && attribute.props.att0AttributeTable ) {
                    var dbValues = attribute.props.att0AttributeTable.dbValues;
                    if( dbValues && dbValues.length > 0 && dbValues[ 0 ] !== null && dbValues[ 0 ] !== '' && vmo.props && vmo.props.att1TablesHashValue ) {
                        var hashValueStr = vmo.props.att1TablesHashValue.dbValues[ 0 ];
                        var hashValue = hashValueStr.split( ' ' );
                        if( columnName === GOAL_COLUMN_NAME ) {
                            propValue = hashValue[ 0 ];
                        } else if( columnName === MIN_COLUMN_NAME ) {
                            propValue = hashValue[ 1 ];
                        } else if( columnName === MAX_COLUMN_NAME ) {
                            propValue = hashValue[ 2 ];
                        } else if( columnName === MEASUREMENT_COLUMN_NAME ) {
                            propValue = hashValue[ 3 ];
                        }
                    }
                }
            }
        }
    }
    if( propValue.length < 1 || propValue === '' ) {
        propValue = vmo.props[ columnName ].dbValues[ 0 ];
    }
    return propValue;
}
// Highlight Text in red color for given cells
// eslint-disable-next-line require-jsdoc
function highlightValueDifference( cellTopArray ) {
    _.forEach( cellTopArray, function( cellTop ) {
        if( cellTop ) {
            cellTop.classList.add( 'aw-parameter-highlightDifference' );
        }
    } );
}

// Show red colored indicator for given cells
// eslint-disable-next-line require-jsdoc
function showRedIndicator( cellTopArray ) {
    _.forEach( cellTopArray, function( cellTop ) {
        if( cellTop ) {
            var cellIndicator = cellTop.getElementsByClassName( 'aw-widgets-gridCellColorContainer' )[ 0 ];
            if( cellIndicator && cellIndicator.classList.contains( 'aw-parameter-showYellowIndicator' ) === true ) {
                cellIndicator.classList.remove( 'aw-parameter-showYellowIndicator' );
            }
            cellIndicator.classList.add( 'aw-parameter-showRedIndicator' );
            var tooltip = localeTextBundle.Att1DifferentValue;
            cellIndicator.setAttribute( 'title', tooltip );
        }
    } );
}

// Show yellow colored indicator for given cells
// eslint-disable-next-line require-jsdoc
function showYellowIndicator( cellTopArray ) {
    _.forEach( cellTopArray, function( cellTop ) {
        if( cellTop ) {
            var cellIndicator = cellTop.getElementsByClassName( 'aw-widgets-gridCellColorContainer' )[ 0 ];
            if( cellIndicator && cellIndicator.classList.contains( 'aw-parameter-showRedIndicator' ) === false ) {
                cellIndicator.classList.add( 'aw-parameter-showYellowIndicator' );
                var tooltip = localeTextBundle.Att1MissingParameter;
                cellIndicator.setAttribute( 'title', tooltip );
            }
        }
    } );
}

var canAutoExpand = function( vmo ) {
    var canExpand = false;
    if( vmo.childVmNodes && vmo.childVmNodes.length > 0 && ( vmo.isExpanded === undefined || vmo.isExpanded === false ) ) {
        _.every( vmo.childVmNodes, function( childVmo ) {
            if( childVmo.isDummy && childVmo.isDummy === true ) {
                canExpand = true;
                return false;
            }
            _.every( compareColumns, function( col ) {
                var parentPropVal = null;
                var childPropVal = null;
                if( childVmo.props && childVmo.props[ col ] ) {
                    childPropVal = getPropValueForVMO( childVmo, col );
                }
                if( vmo.props && vmo.props[ col ] ) {
                    parentPropVal = getPropValueForVMO( vmo, col );
                }
                if( parentPropVal !== childPropVal ) {
                    canExpand = true;
                    return false;
                }
                return true;
            } );
            if( canExpand ) {
                return false;
            }
            return true;
        } );
    }

    return canExpand;
};

/**
 * Sets cell renderers for the PL table
 * @param {Object} colDefs - columns
 */
export let setCellRenderers = function( columns, parametersTable, vmNodes ) {
    var prefs = preferenceService.getLoadedPrefs();
    if( prefs.PLE_Parameters_ComparisonColumns !== undefined ) {
        compareColumns = prefs.PLE_Parameters_ComparisonColumns;
    }
    isCompareModeOn = false;
    isCompareModeOn = _.get( parametersTable, 'options.compareParameters', undefined );

    if( uidToVMNodeMap.size > 0 ) {
        uidToVMNodeMap.clear();
    }
    if( vmNodes !== undefined ) {
        _.forEach( vmNodes, function( vmo ) {
            uidToVMNodeMap.set( vmo.uid, vmo );
        } );
    }

    _.forEach( columns, function( col ) {
        col.cellRenderers = [];
        if( columnsToShowHyperlinks.indexOf( col.propertyName ) > -1 ) {
            col.cellRenderers.push( hyperlinkCellRenderer() );
        }
        if( isCompareModeOn === true ) {
            col.cellRenderers.push( _showBackgroundForSourceRender() );
            col.cellRenderers.push( _showDifferenceRender() );
        }
        col.cellRenderers.push( _att1ResultCellRenderer() );
        col.cellRenderers.push( _getEditRequiredCellRenderers() );
    } );

    if( parentToCompareInfo.size > 0 ) {
        parentToCompareInfo.clear();
    }

    // By default all nodes are collapsed
    // To expand the nodes which have any difference
    eventBus.subscribe( 'uniformParamTable.tableLoaded', function( eventData ) {
        if( eventData && eventData.dataProvider ) {
            _.forEach( eventData.dataProvider.updatedNodes, function( vmo ) {
                if( canAutoExpand( vmo ) ) {
                    eventBus.publish( eventData.dataProvider.name + '.expandTreeNode', { parentNode: vmo } );
                }
            } );
            eventBus.unsubscribe( 'uniformParamTable.tableLoaded' );
        }
    } );
};

export default exports = {
    setCellRenderers
};
