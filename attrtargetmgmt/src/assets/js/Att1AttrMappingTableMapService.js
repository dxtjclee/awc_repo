// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Att1AttrMappingTableMapService
 */
import cdm from 'soa/kernel/clientDataModel';
import msgSvc from 'js/messagingService';
import cmdMapSvc from 'js/commandsMapService';
import localeService from 'js/localeService';
import iconSvc from 'js/iconService';
import policySvc from 'soa/kernel/propertyPolicyService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';

var exports = {};

var _mappingTableContextName = 'Att1ShowMappedAttribute';
var _vmc = null;

/**
 * @param {Object} contextObject the context
 * @returns {boolean} true if the contextObejct is valid and Modifiable
 */
function _isContextModifiable( contextObject ) {
    var inContextWritable = false;
    if( contextObject && contextObject.props && contextObject.props.is_modifiable.dbValues[ 0 ] === '1' ) {
        inContextWritable = true;
    }
    return inContextWritable;
}

/**
 * @param {Array} object the array
 * @returns {boolean} true if the array is populated
 */
function _isArrayPopulated( object ) {
    var isPopulated = false;
    if( object && object.length > 0 ) {
        isPopulated = true;
    }
    return isPopulated;
}

/**
 * @param {Object} contextObject the context
 * @returns {boolean} true if the context is modifiable
 */
function _getIsContextModifiable( contextObject ) {
    var isModifiable = false;
    if( contextObject ) {
        isModifiable = _isContextModifiable( cdm.getObject( contextObject ) );
    }
    return isModifiable;
}

/**
 * @param {Array} inputList the array of inputs
 * @param {Object} contextObject the context
 * @returns {Object} the input object
 */
function _getAttrInput( inputList, contextObject ) {
    var input = null;
    for( var i = 0; i < inputList.length; ++i ) {
        if( inputList[ i ].clientId === contextObject ) {
            input = inputList[ i ];
        }
    }
    return input;
}

/**
 * Get the selected element and attributes for the mapMeasurableAttributes2 SOA
 *
 * @returns {Array} the array of ElementAttrMapInput objects
 */
function _getAutomapSourceObjAndAttrs( commandContext ) {
    var selectedElements = [];
    var attrInputsByElement = {};
    var attrInputs = [];

    var selectedAttrVMTNs = commandContext.parametersTable.selectedObjects;

    // if there are selected attributes we have to add them to the proper attrInput
    if( selectedAttrVMTNs && selectedAttrVMTNs.length > 0 ) {
        var output = getAlignmentObjects( commandContext );
        var alignmentObjs = output.inputObjects;

        _.forEach( selectedAttrVMTNs, function( selectedAttrVMTN ) {
            var selectedAttrProxy = cdm.getObject( selectedAttrVMTN.uid );

            if( alignmentObjs ) {
                for( var a = 0; a < alignmentObjs.length; a++ ) {
                    if( selectedAttrProxy.props.att1AttributeAlignment.dbValues[ 0 ] === alignmentObjs[ a ].uid ) {
                        // not top-level, exclude
                        return;
                    }
                }
            }

            // find the attrInput for the source element
            var selectedElementUid = selectedAttrVMTN.props.att1SourceElement.dbValues[ 0 ];
            var selectedElement = cdm.getObject( selectedElementUid );

            var attrInput = null;

            for( var sourceElementName in attrInputsByElement ) {
                if( sourceElementName === selectedElementUid ) {
                    attrInput = attrInputsByElement[ sourceElementName ];
                    break;
                }
            }

            // if not found, add a new one
            if( attrInput === null ) {
                attrInput = {
                    sourceElement: selectedElement,
                    attributes: []
                };
                attrInputsByElement[ selectedElementUid ] = attrInput;
            }

            // add the selected attribute to attrInput
            var selectedAttr = cdm.getObject( selectedAttrProxy.props.att1SourceAttribute.dbValues[ 0 ] );
            attrInput.attributes.push( selectedAttr );
        } );
    } else {
        selectedElements = commandContext.parametersTable.parentObjects;

        // for each selected element, put an attrInput in attrInputsByElement
        // index the elements by name so we can match them with their attributes if any are selected
        _.forEach( selectedElements, function( selectedElement ) {
            var attrInput = {
                sourceElement: selectedElement,
                attributes: []
            };
            var elementName = selectedElement.uid;
            attrInputsByElement[ elementName ] = attrInput;
        } );
    }

    for( var elementName in attrInputsByElement ) {
        if( attrInputsByElement.hasOwnProperty( elementName ) ) {
            attrInputs.push( attrInputsByElement[ elementName ] );
        }
    }

    return attrInputs;
}

/**
 * Get the root element for the mapMeasurableAttributes2 SOA input
 *
 * @returns {Object} the rootElement object
 */
function _getAutomapRootObject( occContext ) {
    // get the root object
    var autoMapRootObj = [];

    if( occContext.elementToPCIMap ) {
        var uids = Object.keys( occContext.elementToPCIMap );
        for( var i in uids ) {
            autoMapRootObj.push( cdm.getObject( uids[ i ] ) );
        }
    }

    if( autoMapRootObj.length === 0 ) {
        autoMapRootObj.push( occContext.topElement );
    }

    return autoMapRootObj;
}

/**
 * Get the product context for the mapMeasurableAttributes2 SOA input
 *
 * @returns {Object} the Awb0ProductContextInfo object
 */
function _getAutomapProductCtx( occContext ) {
    // get the product context info
    var autoMapProdCtx = [];

    if( occContext.elementToPCIMap ) {
        for( var i in occContext.elementToPCIMap ) {
            if( occContext.elementToPCIMap.hasOwnProperty( i ) ) {
                autoMapProdCtx.push( cdm.getObject( occContext.elementToPCIMap[ i ] ) );
            }
        }
    }

    if( autoMapProdCtx.length === 0 ) {
        autoMapProdCtx.push( occContext.productContextInfo );
    }

    return autoMapProdCtx;
}

/**
 * Get the attributes for the mapMeasurableAttributes2 SOA input
 *
 * @returns {Array} the array of MapMeasurableAttrInput2 objects
 */
export let getAutomapInputs = function( commandContext ) {
    // get the source object & selected attrs
    var attrInputs = _getAutomapSourceObjAndAttrs( commandContext );

    // get the product info
    var autoMapRootObj = _getAutomapRootObject( commandContext.occContext );
    var autoMapProductCtx = _getAutomapProductCtx( commandContext.occContext );

    var productInfos = [];
    if( autoMapRootObj.lenght === autoMapProductCtx.lenght ) {
        for( var i in autoMapRootObj ) {
            var obj = {
                rootElement: autoMapRootObj[ i ],
                productContext: autoMapProductCtx[ i ]
            };

            productInfos.push( obj );
        }
    }

    // create the input object
    return [ {
        clientId: 'Att1AttributeMappingService',
        elements: attrInputs,
        productInfo: productInfos
    } ];
};

/**
 * Get the preferences for the mapMeasurableAttributes2 SOA input
 *
 * @returns {Object} the MapMeasurableAttrPref2 object
 */
export let getAutomapPrefs = function() {
    return {
        mapObjType: '',
        alignmentObjType: ''
    };
};

/**
 * Evaluate the automap response to see which message to display to the user
 *
 * @param {Object} data the data object
 * @returns {boolean} true if the attribute mapping table should be refreshed
 */
export let evaluateAutomapResults = function( data ) {
    var automapResponse = data.outputs[ 0 ];
    var automapResponseKey = 'autoMappingNoMappingsMsg';
    var refreshTable = false;

    if( !automapResponse || !automapResponse.elementAttrOutputs ||
        automapResponse.elementAttrOutputs.length === 0 ) {
        // no trace link to/from source element
        automapResponseKey = 'autoMappingNoTraceLinksMsg';
    } else {
        var elementAttrOutputs = automapResponse.elementAttrOutputs;
        for( var idx = 0; idx < elementAttrOutputs.length; idx++ ) {
            // if any of the attrMapOutputs have an attrAlignments array, something was mapped
            var attrMapOutputs = elementAttrOutputs[ idx ].attrMapOutputs;

            for( var jdx = 0; jdx < attrMapOutputs.length; jdx++ ) {
                if( attrMapOutputs[ jdx ].attrAlignments.length > 0 ) {
                    automapResponseKey = 'autoMappingSucceededMsg';
                    refreshTable = true;
                    break;
                }
            }

            if( refreshTable ) {
                break;
            }
        }
    }

    // display message
    var resource = 'Att1AttrMappingMessages';
    var localTextBundle = localeService.getLoadedText( resource );
    var automapResponseMessage = localTextBundle[ automapResponseKey ];
    msgSvc.showInfo( automapResponseMessage );

    // return outputs
    return refreshTable;
};

/**
 * Map measurable attributes
 *
 * @param {Array} inputProxyObjects The input attribute
 * @param {Array} selectedProxyObjects The selected proxy objects
 * @param {Object} parametersTable the application context
 */
export let mapAttributes = function( inputProxyObjects, selectedProxyObjects, parametersTable ) {
    var inputAttr = '';

    if( _isArrayPopulated( inputProxyObjects ) ) {
        if( parametersTable && parametersTable.openedObject && parametersTable.openedObject.modelType && parametersTable.openedObject.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) > -1 ) {
            inputAttr = inputProxyObjects[ 0 ].props.att1AttrContext.dbValue;
        } else {
            inputAttr = inputProxyObjects[ 0 ].props.att1SourceAttribute.dbValue;
        }
    }

    var nonModifiableList = [];
    if( _isArrayPopulated( selectedProxyObjects ) && inputAttr ) {
        var inputList = [];
        for( var idx = 0; idx < selectedProxyObjects.length; ++idx ) {
            var selectedObj = selectedProxyObjects[ idx ];
            var direction = selectedObj.props.att1SourceDirection.dbValue;
            var contextObject = selectedObj.props.att1ContextObject.dbValue;
            var isModifiable = _getIsContextModifiable( contextObject );
            var input = _getAttrInput( inputList, contextObject );

            var attrAlignment;
            var selectedAttr;
            if( parametersTable && parametersTable.openedObject && parametersTable.openedObject.modelType && parametersTable.openedObject.modelType.typeHierarchyArray.indexOf( 'Crt0ContractRevision' ) > -1 ) {
                selectedAttr = selectedObj.props.att1AttrContext.dbValue;
            } else {
                selectedAttr = selectedObj.props.att1SourceAttribute.dbValue;
            }
            if( direction === 'source' || direction === 'Defining' ) {
                attrAlignment = {
                    sourceObj: cdm.getObject( selectedAttr ),
                    targetObj: cdm.getObject( inputAttr )
                };
            } else {
                attrAlignment = {
                    sourceObj: cdm.getObject( inputAttr ),
                    targetObj: cdm.getObject( selectedAttr )
                };
            }

            // The trace link is not modifiable, add the selected to Attribute to the failure list.
            if( !isModifiable ) {
                nonModifiableList.push( selectedObj.props.att1SourceAttribute.displayValues[ 0 ] );
                continue;
            }

            if( input ) {
                input.alignmentInputs.push( attrAlignment );
            } else {
                input = {
                    clientId: contextObject,
                    contextObj: cdm.getObject( contextObject ),
                    alignmentInputs: [ attrAlignment ]
                };
                inputList.push( input );
            }
        }

        var nonModifialbleAttributesList = {
            nonModifialbleAttributesList: {
                length: nonModifiableList.length,
                number_selected: selectedProxyObjects.length,
                AttributeNames: nonModifiableList
            }
        };

        return {
            mapObjectAttributeInput: inputList,
            nonMappableObjects: nonModifialbleAttributesList
        };
    }
};

export let onSublocationSelectionChange = function( eventData ) {
    // On a sublocation selection change, only close the map panel if the selected
    //  object is not a row in the mapping table
    if( eventData && eventData.selected && ( eventData.selected.length === 0 ||
            !cmdMapSvc.isInstanceOf( 'Att1AttributeAlignmentProxy', eventData.selected[ 0 ].modelType ) ) ) {
        eventBus.publish( 'closeMapAttribPanel' );
    }
};

/**
 * Method to create inputs required to make the delete mapping SOA call.
 */
export let getAlignmentObjects = function( commandContext ) {
    var result;
    var inputObjects = [];
    var inputObjectNames = [];
    var totalObjectsCount;

    var selectedObjects = commandContext.parametersTable.selectedObjects;
    if( selectedObjects !== undefined ) {
        for( var i = 0; i < selectedObjects.length; i++ ) {
            var selectedObj = selectedObjects[ i ];
            if( selectedObj.props && selectedObj.props.att1ContextObject && selectedObj.props.att1AttributeAlignment ) {
                var contextObject = cdm.getObject( selectedObj.props.att1ContextObject.dbValues[ 0 ] );
                var aligmentObject = cdm.getObject( selectedObj.props.att1AttributeAlignment.dbValues[ 0 ] );
                // Add if the object is not already on the list
                if( aligmentObject !== null && inputObjects.indexOf( aligmentObject ) === -1 ) {
                    inputObjects.push( aligmentObject );
                    inputObjectNames.push( selectedObj.displayName );
                }
            }
        }
        totalObjectsCount = selectedObjects.length;
    }

    result = {
        inputObjects: inputObjects,
        inputObjectNames: inputObjectNames,
        totalSelected: totalObjectsCount
    };
    return result;
};

var loadConfiguration = function() {
    eventBus.subscribe( 'vmc.new.gridDataProvider', function( event ) {
        if( event.vmc ) {
            _vmc = event.vmc;
        }
    } );
};

loadConfiguration();

/**
 * @param {Object} parametersTable the application context
 * @param {Object} data - The 'data' object from viewModel.
 * @returns {inputData} input data required for the performSearch SOA.
 */
export let getMapAttributeSearchInput = function( parametersTable, data ) {
    var providerName = 'Att1AttributeMapProvider';
    var clientScopeURI = '';
    var productContextUids = '';
    var rootElementUids = '';
    var parentUids = '';
    var seperatorStr = parametersTable.separator;
    if( parametersTable ) {
        if ( data.eventData && data.eventData.selectedProxyParams ) {
            parametersTable.selectedObjects = data.eventData.selectedProxyParams;
            parametersTable.selectedUnderlyingObjects = data.eventData.selectedParams;
        }
        providerName = 'Att1ShowParametersProvider';
        clientScopeURI = parametersTable.clientScopeURI;
        _.forEach( parametersTable.productContextObjects, function( productContextObject ) {
            productContextUids = productContextUids.concat( seperatorStr + productContextObject.uid );
        } );
        productContextUids = productContextUids.slice( seperatorStr.length );

        _.forEach( parametersTable.rootElements, function( rootElement ) {
            rootElementUids = rootElementUids.concat( seperatorStr + rootElement.uid );
        } );
        rootElementUids = rootElementUids.slice( seperatorStr.length );

        var openedObjectUid = parametersTable.parentObjects[0].uid;

        _.forEach( parametersTable.selectedObjects, function( selectedObj ) {
            parentUids = parentUids.concat( seperatorStr + selectedObj.uid );
        } );
        parentUids = parentUids.slice( seperatorStr.length );
    }

    var columnConfigInput = {
        clientName: 'AWClient',
        clientScopeURI: clientScopeURI
    };

    var searchCriteria = {
        openedObjectUid: openedObjectUid,
        parentUids: parentUids,
        searchString: data.filterBox.dbValue,
        productContextUids: productContextUids,
        rootElementUids: rootElementUids,
        separator: seperatorStr
    };
    return {
        columnConfigInput: columnConfigInput,
        searchCriteria: searchCriteria,
        selectedParameters: parametersTable.selectedObjects,
        providerName: providerName
    };
};

export default exports = {
    getAutomapInputs,
    getAutomapPrefs,
    evaluateAutomapResults,
    mapAttributes,
    onSublocationSelectionChange,
    getAlignmentObjects,
    getMapAttributeSearchInput
};
