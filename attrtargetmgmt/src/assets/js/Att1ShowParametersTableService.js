/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * @module js/Att1ShowParametersTableService
 */
import adapterSvc from 'js/adapterService';
import appCtxSvc from 'js/appCtxService';
import attrTableUtils from 'js/attrTableUtils';
import awColumnSvc from 'js/awColumnService';
import awPromiseSvc from 'js/awPromiseService';
import awTableSvc from 'js/awTableService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import iconSvc from 'js/iconService';
import parsingUtils from 'js/parsingUtils';
import soaSvc from 'soa/kernel/soaService';
import policySvc from 'soa/kernel/propertyPolicyService';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import paramTableContributionSvc from 'js/Att1ShowParametersTableContributionService';
import parammgmtUtilSvc from 'js/Att1ParameterMgmtUtilService';
import prefSvc from 'soa/preferenceService';
import cellRenderingService from 'js/Att1CellRenderingService';
import localeService from 'js/localeService';
import att1ViewModelService from 'js/Att1ViewModeService';
import uwPropertySvc from 'js/uwPropertyService';

import _ from 'lodash';
import awTableTreeSvc from 'js/published/splmTablePublishedTreeService';

var exports = {};

var ATT1_COMPARE_PARAMETERS_FILTER = 'Att1CompareParametersFilter';

/**
 * Synchronize the selection of parameters
 *
 * @param {Object} uwDataProvider The Data Provider object
 */
export let setFlagsForWidePanel = function( eventData, parametersTable ) {
    let parametersTableCtx = { ...parametersTable.value };
    if( eventData && eventData.name ) {
        if( eventData.name === 'addNewTableValueCommandClicked' ) {
            parametersTableCtx.addNewTableValueCommandClicked = eventData.value;
            parametersTableCtx.isComplexDataImportInProgress = undefined;
            parametersTableCtx.manageMeasurementsCommandClicked = undefined;
        } else if( eventData.name === 'isComplexDataImportInProgress' ) {
            parametersTableCtx.isComplexDataImportInProgress = eventData.value;
            parametersTableCtx.addNewTableValueCommandClicked = undefined;
            parametersTableCtx.manageMeasurementsCommandClicked = undefined;
        } else if( eventData.name === 'manageMeasurementsCommandClicked' ) {
            parametersTableCtx.manageMeasurementsCommandClicked = eventData.value;
            parametersTableCtx.isComplexDataImportInProgress = undefined;
            parametersTableCtx.addNewTableValueCommandClicked = undefined;
            parametersTableCtx.isShowValuesTable = true;
            parametersTableCtx.isShowChart = false;
        } else if( eventData.name === 'plotChartCommandClicked' ) {
            parametersTableCtx.manageMeasurementsCommandClicked = undefined;
            parametersTableCtx.isComplexDataImportInProgress = undefined;
            parametersTableCtx.addNewTableValueCommandClicked = undefined;
            parametersTableCtx.plotChartCommandClicked = eventData.value;
            parametersTableCtx.isShowValuesTable = false;
            parametersTableCtx.isShowChart = true;
        }
    }
    if( eventData && eventData.isShowMeasurementTab ) {
        parametersTableCtx.isShowValuesTable = true;
        parametersTableCtx.isShowChart = false;
    }
    parametersTableCtx.isParameterWidePanelOpen = true;
    parametersTableCtx.isPanelClosed = false;
    parametersTableCtx.isPanelOpened = false;
    parametersTable.update( parametersTableCtx );
};
export let syncParamSelections = function( uwDataProvider, parametersTable, subPanelContext ) {
    if( uwDataProvider ) {
        let parametersTableCtx = { ...parametersTable.value };
        if( parametersTableCtx.selectedObjects === undefined && parametersTableCtx.selectedUnderlyingObjects && parametersTableCtx.selectedUnderlyingObjects.length === 1 &&
            ( !uwDataProvider.selectedObjects || uwDataProvider.selectedObjects.length === 0 ) ) {
            // if there was a previous selection record it so selection can be resorted if possible
            parametersTableCtx.restoreSelection = parametersTableCtx.selectedUnderlyingObjects[0].uid;
        }
        var selectedObjects = uwDataProvider.selectedObjects;
        parametersTableCtx.selectedObjects = selectedObjects;
        var parentToProxyParametersMap = new Map();

        var selectedElementsFromProxy = [];
        parametersTableCtx.selectedUnderlyingObjects = [];
        var array = [];
        var dummyParamIndx = -1;
        var isDummyParamSelected = false;
        if( selectedObjects.length > 0 ) {
            var underlyingObjects = adapterSvc.getAdaptedObjectsSync( selectedObjects );
            parametersTableCtx.selectedUnderlyingObjects = underlyingObjects;
            eventBus.publish( 'uniformParamTable.selectionChanged', { selectedParams: underlyingObjects, selectedProxyParams: selectedObjects } );

            //when element is selected from parameter table then update selection.
            for ( var i = 0; i < selectedObjects.length; i++ ) {
                array.push( selectedObjects[i] );
            }
            if( subPanelContext.selectionData && subPanelContext.selectionData.value ) {
                const tmpSelectionData = { ...subPanelContext.selectionData.value };
                tmpSelectionData.selected = array;
                dummyParamIndx = array.findIndex( ( param )=>{
                    return Boolean( param.isDummy );
                } );
                if( dummyParamIndx > -1 ) {
                    isDummyParamSelected = true;
                }

                tmpSelectionData.selected[0].isDummyParamSelected = isDummyParamSelected;

                subPanelContext.selectionData.update( tmpSelectionData );
            }

            var isMeasurableAttributeSelcted = true;
            _.forEach( selectedObjects, function( proxyParam ) {
                var parentId = _.get( proxyParam, 'props.att1SourceElement.dbValues[0]', undefined );
                if( parentId ) {
                    var parameterList = parentToProxyParametersMap.get( parentId ) || [];
                    parameterList.push( proxyParam );
                    parentToProxyParametersMap.set( parentId, parameterList );
                }

                var sourceObj = cdm.getObject( _.get( proxyParam, 'props.att1SourceAttribute.dbValues[0]', undefined ) );
                if( sourceObj && sourceObj.modelType.typeHierarchyArray.indexOf( 'Att0MeasurableAttribute' ) < 0 ) {
                    var element = _.get( proxyParam, 'props.att1SourceElement', undefined );
                    isMeasurableAttributeSelcted = false;
                    selectedElementsFromProxy.push( element );
                }
            } );
            parametersTableCtx.isMeasurableAttributeSelected = isMeasurableAttributeSelcted;

            _.every( selectedObjects, function( proxyParam ) {
                // check parent access
                var hasParentAccess = _.get( proxyParam, 'props.att1HasParentWriteAccess.dbValues[0]', undefined );
                if( hasParentAccess === '1' ) {
                    parametersTableCtx.selectedParentsAreModifiable = hasParentAccess === '1';
                    return false;
                }
                parametersTableCtx.selectedParentsAreModifiable = false;
                return true;
            } );
        } else{
            if ( subPanelContext.parametersTable && subPanelContext.parametersTable.parentObjects && subPanelContext.parametersTable.parentObjects.length === 1 ) {
                //when parameter is deselected update selection with parent object.
                array.push( subPanelContext.parametersTable.parentObjects[0] );
            }
            const tmpSelectionData = { ...subPanelContext.selectionData.value };
            if( subPanelContext.selectionData?.value && tmpSelectionData.selected && ( tmpSelectionData.selected?.length > 1
                || subPanelContext.parametersTable.parentObjects?.length > 0 && subPanelContext.parametersTable.parentObjects[0]?.uid !== tmpSelectionData?.selected[0]?.uid ) ) {
                tmpSelectionData.selected = array;
                subPanelContext.selectionData.update( tmpSelectionData );
            }
        }
        parametersTableCtx.parentToProxyParametersMap = parentToProxyParametersMap;
        parametersTableCtx.selectedElementsFromProxy = selectedElementsFromProxy;
        parametersTable.update( parametersTableCtx );
    }
};

/**
 * @param {Object} uwDataProvider - An Object (usually a UwDataProvider) on the DeclViewModel on the $scope this
 *            action function is invoked from.
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 *
 * <pre>
 * {
 *     columnInfos : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadParamTreeColumns = function( uwDataProvider ) {
    var deferred = awPromiseSvc.instance.defer();
    var awColumnInfos = [];
    localeService.getLocalizedText( 'Att1Messages', 'Name' ).then( function( result ) {
        awColumnInfos.push( awColumnSvc.createColumnInfo( {
            name: 'object_name',
            displayName: result,
            typeName: 'Att1AttributeAlignmentProxy',
            width: 200,
            enableColumnResizing: true,
            enableColumnMoving: false,
            isTreeNavigation: true
        } ) );
    } );

    deferred.resolve( {
        columnInfos: awColumnInfos
    } );
    return deferred.promise;
};

/**
 * Load the properties in the parameters tree.
 *
 * @param {PropertyLoadRequestArray} propertyLoadRequests - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 * @returns {Promise} promise
 *
 */
export let loadParamTreeProperties = function() { // eslint-disable-line no-unused-vars
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if( propertyLoadInput ) {
        return _loadProperties( propertyLoadInput, arguments[ 1 ] );
    }

    return awPromiseSvc.instance.reject( 'Missing PropertyLoadInput parameter' );
};

/**
 *
 * @param {Object} propertyLoadInput input
 * @returns{Object} propertyLoadResult property load result
 */
function _loadProperties( propertyLoadInput, paramTableCtx ) {
    var prefs = prefSvc.getLoadedPrefs();
    var compareFilterColumnsList = prefs.PLE_Parameters_ComparisonColumns;
    var allChildNodes = [];
    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: paramTableCtx.clientScopeURI
    };

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            allChildNodes.push( childNode );

            if( childNode.childVmNodes ) {
                _.forEach( childNode.childVmNodes, function( theChild ) {
                    if( !theChild.props ) {
                        theChild.props = {};
                    }
                    allChildNodes.push( theChild );
                } );
            }
        } );
    } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        function( response ) {
            _.forEach( allChildNodes, function( childNode ) {
                var propColumns = response.output.columnConfig.columns;
                _updateTypeNamePropInColConfig( propColumns, compareFilterColumnsList, paramTableCtx );
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[ vmProp.propertyName ] = vmProp;
                } );
            } );
            if( response ) {
                propertyLoadResult.columnConfig = response.output.columnConfig;
            }
            propertyLoadResult.columnConfig.columns[ 0 ].pixelWidth = 200;
            propertyLoadResult.columnConfig.columns.forEach( ( column ) => {
                let propName = column.propertyName.split( '.' ).slice( -1 )[0];
                switch ( propName ) {
                    case 'att0AttrType':
                    case 'att1AttrInOut':
                    case 'att0Uom':
                        column.renderingHint = 'AttDataTypeTableField';
                        break;
                    case 'object_name':
                        if ( column.propertyName.includes( 'att0AttrDefRev' ) ) {
                            column.renderingHint = 'AttDataTypeTableField';
                        }
                        break;
                }
            } );
            setCellRenderers( propertyLoadResult, undefined, paramTableCtx, allChildNodes );
            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
}

/**
 * set the cell renderers
 * @param {*} propertyLoadResult  property load result
 */
export let setCellRenderers = function( propertyLoadResult, columnConfig, paramTableCtx, vmNodes ) {
    if( propertyLoadResult ) {
        if( columnConfig ) {
            propertyLoadResult.columnConfig = columnConfig;
        }
        cellRenderingService.setCellRenderers( propertyLoadResult.columnConfig.columns, paramTableCtx, vmNodes );

        //update viewModelProperties
        for( var x = 0; x < propertyLoadResult.updatedNodes.length; ++x ) {
            if( propertyLoadResult.updatedNodes[ x ].isDummy === true ) {
                propertyLoadResult.updatedNodes[ x ].typeIconURL = propertyLoadResult.updatedNodes[ x ].iconURL;
            }
        }
    }
    return {
        propertyLoadResult: propertyLoadResult
    };
};

/**
 * Update type name property in column config
 * @param {*} propColumns column config
 */
function _updateTypeNamePropInColConfig( propColumns, compareFilterColumns, paramTableCtx ) {
    var comapreParameters = _.get( paramTableCtx, 'options.compareParameters', false );
    _.forEach( propColumns, function( col ) {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
            if( comapreParameters === true && compareFilterColumns ) {
                for( var i in compareFilterColumns ) {
                    if( compareFilterColumns[ i ] === col.propertyName ) {
                        col.filterDefinition = ATT1_COMPARE_PARAMETERS_FILTER;
                    }
                }
            }
        }
    } );
}

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
 *            the result of processing the 'inputData' property of a DeclAction based on data from the current
 *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
 *
 * <pre>
 * {
 * Extra 'debug' Properties
 *     dbg_isLoadAllEnabled: {Boolean}
 *     dbg_pageDelay: {Number}
 * }
 * </pre>
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadParamTreeData = function( treeLoadInput, sortCriteria, columnFilters, parametersTable ) {
    var deferred = awPromiseSvc.instance.defer();


    if( treeLoadInput.parentNode.levelNdx < 0 ) {
        eventBus.publish( 'uniformParamDataProvider.resetState' );
    }
    // Set the default page size
    treeLoadInput.pageSize = 50;

    // if the child vm nodes were loaded before, just show them.
    if( treeLoadInput.parentNode.childVmNodes ) {
        var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, treeLoadInput.parentNode.childVmNodes, true, true, true, null );
        var tempCursorObject = {
            endReached: true,
            startReached: true
        };
        treeLoadResult.parentNode.cursorObject = tempCursorObject;
        deferred.resolve( {
            treeLoadResult: treeLoadResult
        } );
        return deferred.promise;
    }
    /**
     * Get the 'child' nodes async
     */
    _buildTreeTableStructure( deferred, treeLoadInput, sortCriteria, columnFilters, parametersTable );
    return deferred.promise;
};

/**
 * Build the parameters tree strcuture
 *
 * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {SortCriteria} sortCriteria - Sort criteria
 * @param {ColumnCriteria} columnFilters - Column filters
 *
 * @return
 */
function _buildTreeTableStructure( deferred, treeLoadInput, sortCriteria, columnFilters, paramTableCtx ) {
    var parentNode = treeLoadInput.parentNode;
    treeLoadInput.parentElement = parentNode.levelNdx === -1 ? 'AAAAAAAAAAAAAA' : parentNode.id;
    treeLoadInput.displayMode = 'Tree';

    var policyInput = _getPolicyInputForParameterTable( paramTableCtx );
    var compareParameters = _.get( paramTableCtx, 'options.compareParameters', undefined );
    if( compareParameters === true ) {
        var property = { name: 'att1TablesHashValue' };
        policyInput.types[ 0 ].properties.push( property );
    }

    var showMappedParameters = _.get( paramTableCtx, 'options.showMappedParameters', undefined );
    if( showMappedParameters === true ) {
        var property = { name: 'att1AttributeAlignment' };
        policyInput.types[ 0 ].properties.push( property );
        var contextObjProperty = { name: 'att1ContextObject' };
        policyInput.types[ 0 ].properties.push( contextObjProperty );
    }

    //ensure the required objects are loaded
    var policyId = policySvc.register( policyInput );

    var soaInput = _prepareSoaInputForTreeLoad( treeLoadInput, sortCriteria, columnFilters, paramTableCtx );

    soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput )
        .then( function( response ) {
            var _proxyObjects = [];
            if( response.searchResultsJSON ) {
                var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                if( searchResults ) {
                    for( var x = 0; x < searchResults.objects.length; ++x ) {
                        var uid = searchResults.objects[ x ].uid;
                        var obj = response.ServiceData.modelObjects[ uid ];
                        if( obj ) {
                            _proxyObjects.push( obj );
                        }
                    }
                }
            }
            if( policyId ) {
                policySvc.unregister( policyId );
            }

            var treeLoadResult = _processProviderResponse( treeLoadInput, _proxyObjects, response.totalFound, columnFilters, paramTableCtx );
            deferred.resolve( {
                treeLoadResult: treeLoadResult,
                response: response
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
}

var _getPolicyInputForParameterTable = function( paramTableCtx ) {
    var policy = {
        types: [ {
            name: 'Att1AttributeAlignmentProxy',
            properties: [ {
                name: 'att1SourceAttribute',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }, {
                name: 'att1HasChildren'
            }, {
                name: 'att1SourceElement'
            }, {
                name: 'att1Parent'
            }, {
                name: 'att1HasParentWriteAccess'
            }
            ]
        } ]

    };
    if( paramTableCtx.policy ) {
        var policyTypeFromContribution = paramTableCtx.policy.types;
        var isNewType = true;

        _.forEach( policyTypeFromContribution, function( newType ) {
            _.forEach( policy.types, function( type ) {
                if( newType.name === type.name ) {
                    isNewType = false;
                    var isNewProp = true;

                    for( var i = 0; i < newType.properties.length; i++ ) {
                        for( var j = 0; j < type.properties.length; j++ ) {
                            if( newType.properties[i].name === type.properties[j].name ) {
                                isNewProp = false;
                                type.properties[j] = newType.properties[i];
                            }
                        }
                        if( isNewProp === true ) {
                            type.properties.push( newType.properties[i] );
                        }
                        isNewProp = true;
                    }
                }
            } );
            if( isNewType ) {
                policy.types.push( newType );
            }
            isNewType = true;
        } );
    }
    return policy;
};

var _prepareSoaInputForTreeLoad = function( treeLoadInput, sortCriteria, columnFilters, paramTableCtx ) {
    var fieldName = '';
    var sortDirection = '';

    //Logic to filter pie chart
    if( paramTableCtx && paramTableCtx.columnFilters && paramTableCtx.columnFilters.length > 0 &&
        ( !columnFilters || columnFilters.length === 0 ) ) {
        // Apply additional filter e.g. chart
        // Table filter manually set by user is high priority than the additional filters.
        columnFilters = paramTableCtx.columnFilters;
    }

    if( sortCriteria && sortCriteria.length > 0 ) {
        fieldName = sortCriteria[ 0 ].fieldName;
        sortDirection = sortCriteria[ 0 ].sortDirection;
    }

    //return soaInput
    return {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: paramTableCtx.clientScopeURI
        },
        searchInput: {
            maxToLoad: treeLoadInput.pageSize,
            maxToReturn: treeLoadInput.pageSize,
            providerName: paramTableCtx.dataProvider,
            searchSortCriteria: [ {
                fieldName: fieldName,
                sortDirection: sortDirection
            } ],
            searchCriteria: _getSearchCriteria( treeLoadInput, paramTableCtx ),
            startIndex: treeLoadInput.startChildNdx,
            columnFilters: columnFilters
        }
    };
};

/**
 * Method to set the falg in parameter context to decide whether to fetch parameters from all childrens
 */
export let showChildrenParametersSelected = function( parametersTable ) {
    let paramTableCtx = { ...parametersTable.value };

    if( paramTableCtx ) {
        if( paramTableCtx.options === undefined || paramTableCtx.options.showFromChildren === undefined ) {
            paramTableCtx.options = paramTableCtx.options || {};
            paramTableCtx.options.showFromChildren = true;
        } else {
            paramTableCtx.options.showFromChildren = !paramTableCtx.options.showFromChildren;
        }

        parametersTable.update( paramTableCtx );
        eventBus.publish( 'uniformParamTable.reloadTable' );
    }
};

/**
 * @param {ModelObject} modelObjectsUIDs - Array of model objects UIDs
 * @param {modelObj} modelObj - modelObj
 * @return {String} Uids string
 */
function _isSelectedElementAlreadyPresent( modelObjectsUIDs, modelObj ) {
    if( modelObj && modelObj.props.awb0Parent ) {
        var parentUid = modelObj.props.awb0Parent.dbValues[ 0 ];
        var isPresent = false;
        while( !isPresent && parentUid ) {
            if( modelObjectsUIDs.indexOf( parentUid ) >= 0 ) {
                isPresent = true;
            } else {
                var parent = cdm.getObject( parentUid );
                if( parent && parent.props.awb0Parent ) {
                    parentUid = parent.props.awb0Parent.dbValues[ 0 ];
                } else {
                    parentUid = null;
                }
                isPresent = false;
            }
        }

        if( isPresent ) {
            return true;
        }
    }
    return false;
}

/**
 * @param {ModelObject} modelObjects - Array of model objects
 * @param {separator} separator - separator to be used to combine the uid of the model object
 * @return {String} Uids string
 */
function _getUidsString( parametersTableViewMode, modelObjects, separator ) {
    var uids = '';

    var modelObjectsUIDs = [];
    if( modelObjects && modelObjects.length > 0 ) {
        for( var idx = 0; idx < modelObjects.length; ++idx ) {
            if( modelObjects[ idx ] && modelObjects[ idx ].uid ) {
                modelObjectsUIDs.push( modelObjects[ idx ].uid );
            }
        }
    }

    if( modelObjects && modelObjects.length > 0 ) {
        for( var idx = 0; idx < modelObjects.length; ++idx ) {
            if( modelObjects[ idx ] && modelObjects[ idx ].uid ) {
                var modelObj = cdm.getObject( modelObjects[ idx ].uid );
                if( parametersTableViewMode.viewModeContext === 'showChildLines' && modelObj &&
                    ( modelObj.modelType.typeHierarchyArray.indexOf( 'Att1ParameterPrjElement' ) > -1 ||
                        modelObj.modelType.typeHierarchyArray.indexOf( 'Att1ParameterSetElement' ) > -1 ) ) {
                    if( _isSelectedElementAlreadyPresent( modelObjectsUIDs, modelObj ) ) {
                        continue;
                    }
                }
                uids = uids.concat( modelObjects[ idx ].uid );
                if( idx < modelObjects.length - 1 ) {
                    uids = uids.concat( separator );
                }
            }
        }
    }
    return uids;
}

/**
 * @param {Boolean} value - true/false
 * @return {Boolean} Boolean value true/false
 */
function _getBooleanValue( value, defaultValue ) {
    if( value && value === true ) {
        return 'true';
    }
    return defaultValue;
}

/**
 * @param {String} value - string value
 * @return {String} If the given value is not empty, return. Oterwise return the default value.
 */
function _getStringValue( value, defaultValue ) {
    if( value ) {
        return value;
    }
    return defaultValue;
}

/**
 * @return {Object} Search criteria object
 */
function _getSearchCriteria( treeLoadInput, paramTableCtx ) {
    var parentNode = treeLoadInput.parentNode;
    var paramTableViewModeCtx = paramTableCtx.parametersTableViewMode;
    var searchCriteria = {
        requestId: paramTableCtx.requestId,
        parentUids: parentNode.levelNdx === -1 ? _getUidsString( paramTableCtx.parametersTableViewMode, paramTableCtx.parentObjects, paramTableCtx.separator ) : parentNode.id,
        productContextUids: _getUidsString( paramTableCtx.parametersTableViewMode, paramTableCtx.productContextObjects, paramTableCtx.separator ),
        rootElementUids: _getUidsString( paramTableCtx.parametersTableViewMode, paramTableCtx.rootElements, paramTableCtx.separator ),
        separator: _getStringValue( paramTableCtx.separator, ' ' ),
        usage: _getStringValue( paramTableCtx.usage, ' ' ),
        openedObjectUid: paramTableCtx.openedObject ? paramTableCtx.openedObject.uid : '',
        searchString: _getStringValue( paramTableCtx.searchString, '' ),
        dcpSortByDataProvider: 'true'
    };

    // Set the options
    if( paramTableCtx.options ) {
        for( var prop in paramTableCtx.options ) {
            searchCriteria[ prop ] = _getBooleanValue( paramTableCtx.options[ prop ], 'false' );
        }
    }

    // Set the addtional search criteria
    if( paramTableCtx.searchCriteria ) {
        for( var prop in paramTableCtx.searchCriteria ) {
            var additionalSearchCriteria = paramTableCtx.searchCriteria[ prop ];
            if( additionalSearchCriteria instanceof Object ) {
                for( var key in additionalSearchCriteria ) {
                    searchCriteria[ key ] = _getStringValue( additionalSearchCriteria[ key ], '' );
                }
            } else {
                searchCriteria[ prop ] = _getStringValue( additionalSearchCriteria, '' );
            }
        }
    }
    // Search criteria update for Parameter table mode for Item based Parameter project/Set
    if( paramTableViewModeCtx.viewModeContext === 'showChildLines' ) {
        searchCriteria.showChildLines = 'true';
        searchCriteria.showMappedParameters = 'false';
        searchCriteria.showFromChildren = 'false';
    }
    return searchCriteria;
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ISOAResponse} searchResults - SOA Response
 * @param {totalFound} totalFound - Total found objects
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 */
function _processProviderResponse( treeLoadInput, searchResults, totalFound, columnFilters, paramTableCtx ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.parentNode;
    var parentUid = parentNode.uid === 'top' ? '' : parentNode.uid;
    var levelNdx = parentNode.levelNdx + 1;
    var vmNodes = [];
    var parentToChildrenMap = new Map();
    var childNdx = 0;
    _.forEach( searchResults, function( object ) {
        if( object.props && object.props.att1Parent ) {
            var theParentUid = object.props.att1Parent.dbValues.length > 0 ? object.props.att1Parent.dbValues[ 0 ] : '';
            if( parentUid === theParentUid ) {
                var vmNode = _createVMNodeUsingObjectInfo( object, childNdx, levelNdx, parentNode );
                if( vmNode ) {
                    vmNodes.push( vmNode );
                    parentNode.isLeaf = false;
                    ++childNdx;
                }
            } else {
                var isPresent = parentToChildrenMap.has( theParentUid );
                if( isPresent ) {
                    var children = parentToChildrenMap.get( theParentUid );
                    children.push( object );
                } else {
                    parentToChildrenMap.set( theParentUid, [ object ] );
                }
            }
        }
    } );

    var endReachedVar = vmNodes.length === 0 || vmNodes.length + treeLoadInput.startChildNdx === totalFound;
    // when in compare parameters view, some additional checks are required to decise endReached flag
    if ( paramTableCtx ) {
        var comapreParameters = _.get( paramTableCtx, 'options.compareParameters', false );
        var isCalaulateEndReached = true;
        if( columnFilters.length > 0  ) {
            var filterType =  columnFilters[0].operation;
            if( filterType === 'hasValue' || filterType === 'hasNoValue' || filterType === 'sameValue' || filterType === 'differentValue' ) {
                isCalaulateEndReached = false;
            }
        }
        if ( comapreParameters && isCalaulateEndReached ) {
            var comparisionElements = _.get( paramTableCtx, 'searchCriteria.comparisionElements.comparisonElementUids', '' );
            var separator = _.get( paramTableCtx, 'separator', 0 );
            if( comparisionElements.length > 0 ) {
                var size = comparisionElements.split( separator ).length;
                var totalChildernNodes = ( vmNodes.length + treeLoadInput.startChildNdx ) * size;
                var totalTopNodes = vmNodes.length + treeLoadInput.startChildNdx;
                endReachedVar = totalTopNodes + totalChildernNodes === totalFound;
            }
        }
    }
    var tempCursorObject = {
        endReached: endReachedVar,
        startReached: true
    };
    parentNode.cursorObject = tempCursorObject;

    if( parentToChildrenMap.size > 0 && vmNodes.length > 0 ) {
        _.forEach( vmNodes, function( vmo ) {
            if( parentToChildrenMap.has( vmo.uid ) ) {
                vmo.isLeaf = false;
                childNdx = 0;
                parentNode = vmo;
                levelNdx = parentNode.levelNdx + 1;
                vmo.childVmNodes = [];
                _.forEach( parentToChildrenMap.get( vmo.uid ), function( object ) {
                    var vmNode = _createVMNodeUsingObjectInfo( object, childNdx, levelNdx, parentNode );
                    vmNode.parentVmNode = vmo.uid;
                    vmo.childVmNodes.push( vmNode );
                } );
            } else {
                vmo.isLeaf = true;
            }
        } );
    }

    if( searchResults.length === 0 && totalFound === 0 ) {
        parentNode.isLeaf = true;
    }

    // Third Paramter is for a simple vs ??? tree
    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, true, endReachedVar, null );
}

/**
 * @param {Object} obj - Object sent by server
 * @param {childNdx} childNdx Child Index
 * @param {levelNdx} levelNdx Level Index
 * @param {parentNode} parentNode Parent node
 * @param {string} noOfChildren the count of number of children
 * @return {ViewModelTreeNode} View Model Tree Node
 */
function _createVMNodeUsingObjectInfo( obj, childNdx, levelNdx, parentNode, noOfChildren ) {
    var displayName;
    var objUid = obj.uid;
    var objType = obj.type;
    var isDummy = false;

    var hasChildren = noOfChildren ? noOfChildren : obj.props.att1HasChildren.dbValues[ 0 ];
    if( obj.props && obj.props.object_string ) {
        displayName = obj.props.object_string.uiValues[ 0 ];
    }
    // get Icon for node
    var srcObject = cdm.getObject( obj.props.att1SourceAttribute.dbValues[ 0 ] );
    var iconURL;

    if( srcObject !== null ) {
        // get Icon for node
        iconURL = _evaluateIconUrlForNode( srcObject.type );

        // Update the display name as source object's name
        if( srcObject.props && srcObject.props.object_name ) {
            displayName = srcObject.props.object_name.uiValues[ 0 ];
        }

        // Update is_modifiable
        if( srcObject.props && srcObject.props.is_modifiable ) {
            obj.props.is_modifiable = srcObject.props.is_modifiable;
        }
    } else {
        // get Icon from parent node
        isDummy = true;
        parentNode = cdm.getObject( parentNode.uid );
        if( parentNode.props && parentNode.props.att1SourceAttribute ) {
            var parentSrcObject = cdm.getObject( parentNode.props.att1SourceAttribute.dbValues[ 0 ] );
            iconURL = _evaluateIconUrlForNode( parentSrcObject.type );
            displayName = parentNode.props.object_string.uiValues[ 0 ];
            obj.props.is_modifiable = false;
        }
    }

    var vmNode = awTableTreeSvc
        .createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );

    vmNode.isLeaf = hasChildren === '0';
    //TODO - this one causing recursive assignment of parent node. so commenting temp
    vmNode.parentNode = parentNode.uid;
    vmNode.isDummy = isDummy;
    return vmNode;
}

/**
 * function to evaluate the icon URL
 * @param {objType} objType object type
 * @return {iconURL} iconURL
 */
function _evaluateIconUrlForNode( objType ) {
    var iconURL = null;
    if( objType ) {
        iconURL = iconSvc.getTypeIconURL( objType );
    }
    return iconURL;
}

/**
 * Initialize the parameters table for XRT
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let initParametersTableForXRT = function( parentObject, commandContext, parametersTable ) {
    var deferred = awPromiseSvc.instance.defer();
    const parametersTableCtx = _.clone( parametersTable );
    parametersTableCtx.parametersTableViewMode = {};
    att1ViewModelService.setAvailableViewModes( parametersTableCtx.parametersTableViewMode, [ 'hideChildLines', 'showChildLines' ] );
    var currentViewMode = att1ViewModelService.getViewMode( parametersTableCtx.parametersTableViewMode, commandContext.selected );
    if( currentViewMode === undefined ) {
        att1ViewModelService.changeViewMode( parametersTableCtx.parametersTableViewMode, 'hideChildLines' );
    }
    _initParametersTableWithDefault( commandContext, parametersTableCtx );
    // Set the parent objects
    parametersTableCtx.parentObjects = parentObject;
    parametersTableCtx.editContext = 'NONE';

    paramTableContributionSvc.getContributedParametersTable( commandContext, parametersTableCtx ).then( function() {
        var parentObject = _.get( parametersTableCtx, 'parentObjects', undefined );
        _checkParentObjects( parentObject, parametersTableCtx );
        deferred.resolve( {
            parametersTable: parametersTableCtx
        } );
    } );

    return deferred.promise;
};

/**
 * Initialize the parameters table for Elements
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let initParametersTableForSync = function( parentObjects, commandContext, parametersTable ) {
    var deferred = awPromiseSvc.instance.defer();
    const parametersTableCtx = _.clone( parametersTable );
    parametersTableCtx.parametersTableViewMode = {};
    att1ViewModelService.setAvailableViewModes( parametersTableCtx.parametersTableViewMode, [ 'hideChildLines', 'showChildLines' ] );

    var currentViewMode = att1ViewModelService.getViewMode( parametersTableCtx.parametersTableViewMode, commandContext.selected );
    if( currentViewMode === undefined ) {
        att1ViewModelService.changeViewMode( parametersTableCtx.parametersTableViewMode, 'hideChildLines' );
    }
    _initParametersTableWithDefault( commandContext, parametersTableCtx );

    //if the selected object is proxy then we should set owning object as parent object
    //As we enabled the the parameter sync table for multiple selection of Group , we need to handle the proxy objects.
    var parentObjs = [];
    _.forEach( parentObjects, function( parentObj ) {
        if( parentObj.modelType && parentObj.modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 ) {
            parentObjs.push( parammgmtUtilSvc.getOwningObjectFromParamProxy( parentObj ) );
        } else {
            parentObjs.push( parentObj );
        }
    } );
    // Set the parent objects
    parametersTableCtx.editContext = 'NONE';
    parametersTableCtx.parentObjects = parentObjs;

    paramTableContributionSvc.getContributedParametersTable( commandContext, parametersTableCtx ).then( function() {
        var parentObjects = _.get( parametersTableCtx, 'parentObjects', undefined );
        _checkParentObjects( parentObjects, parametersTableCtx );
        deferred.resolve( {
            parametersTable: parametersTableCtx
        } );
    } );
    return deferred.promise;
};

function _checkParentObjects( parentObjects, parametersTableCtx ) {
    if( parentObjects && parentObjects.length > 0 ) {
        var underlyingObjects = adapterSvc.getAdaptedObjectsSync( parentObjects );
        if( underlyingObjects && underlyingObjects.length === 1 ) {
            var underlyingObject = underlyingObjects[ 0 ];
            if( underlyingObject && underlyingObject.props && underlyingObject.props.is_modifiable ) {
                var isModifiable = underlyingObject.props.is_modifiable.dbValues[ 0 ];
                parametersTableCtx.selectedParentsAreModifiable = isModifiable === '1';
            } else { //TO_DO : This is async function. Need to validate if its behaving correctly
                // To load is_modifiable
                var underlyingObjectUid = underlyingObject.uid;
                var propertiesToLoad = [ 'is_modifiable' ];
                var objArray = [];
                objArray.push( {
                    uid: underlyingObjectUid
                } );

                parammgmtUtilSvc.loadModelObjects( objArray, propertiesToLoad ).then( function() {
                    setTimeout( function() {
                        underlyingObject = cdm.getObject( underlyingObjectUid );
                        if( underlyingObject && underlyingObject.props && underlyingObject.props.is_modifiable ) {
                            var isModifiable = underlyingObject.props.is_modifiable.dbValues[ 0 ];
                            parametersTableCtx.selectedParentsAreModifiable = isModifiable === '1';
                        }
                    }, 500 );
                } );
            }
        }
    }
}

/**
 * Initilalize the parameters table
 */
function _initParametersTableWithDefault( commandContext, parametersTableCtx ) {
    //update the Override Label in context from Locale
    localeService.getLocalizedText( 'Att1Messages', 'OverrideLabel' ).then( function( result ) {
        parametersTableCtx.OverrideLabel = result;
    } );

    // Set the opened object
    var openedObjectUid = attrTableUtils.getOpenedObjectUid();
    var openedObject = cdm.getObject( openedObjectUid );

    parametersTableCtx.openedObject = openedObject;

    // Set the view mode
    parametersTableCtx.viewMode = 'tree';

    // In ACE sublocation, set the Product Context objects and root elements
    var productContextObjects = [];
    var rootElements = [];
    updateParameterTableCtxForProductInfo( commandContext, productContextObjects, rootElements );

    parametersTableCtx.productContextObjects = productContextObjects;
    parametersTableCtx.rootElements = rootElements;
}

/**
 * Get request id
 */
var _getRequestId = function() {
    return Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 ) +
        Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
};

/**
 * Get Product Context objects and root elements
 */
var _getProductContextOrRootElementObjects = function( commandContext, productContextObjects, rootElements ) {
    var occmgmtContext = commandContext.context.occContext;
    var occurence = occmgmtContext && occmgmtContext.openedElement;
    if( occmgmtContext && occmgmtContext.elementToPCIMap ) {
        for( var k in occmgmtContext.elementToPCIMap ) {
            if( occmgmtContext.elementToPCIMap[ k ] ) {
                productContextObjects.push( cdm.getObject( occmgmtContext.elementToPCIMap[ k ] ) );
                rootElements.push( cdm.getObject( k ) );
            }
        }
    }
    if( rootElements.length === 0 ) {
        if( occurence && occurence.modelType && occurence.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            var loop = true;
            while( loop ) {
                if( occurence.props.awb0Parent && occurence.props.awb0Parent.dbValues[ 0 ] ) {
                    occurence = cdm.getObject( occurence.props.awb0Parent.dbValues[ 0 ] );
                } else {
                    loop = false;
                }
            }
        }
        productContextObjects.push( occmgmtContext.productContextInfo );
        rootElements.push( occurence );
    }
};

/**
 * Refresh uniform table on selection change
 */
export let processSelectionChangeAction = function( eventData, selection, parametersTable ) {
    //TODO:Before removing "eventData" . Need to check if any depdency from legacy parameter project
    const parametersTableCtx = _.clone( parametersTable );
    // update parent objects and load uniform table
    if( eventData && eventData.dataProvider && eventData.dataProvider.selectedObjects.length > 0 ) {
        //if the selected object is proxy then we should set owning object as parent object
        //As we enabled the the parameter sync table for multiple selection of Group , we need to handle the proxy objects.
        var selectedObjects = [];
        _.forEach( eventData.dataProvider.selectedObjects, function( selectedObject ) {
            if( selectedObject.modelType && selectedObject.modelType.typeHierarchyArray.indexOf( 'Att1AttributeAlignmentProxy' ) > -1 ) {
                selectedObjects.push( parammgmtUtilSvc.getOwningObjectFromParamProxy( selectedObject ) );
            } else {
                selectedObjects.push( selectedObject );
            }
        } );
        parametersTableCtx.parentObjects = selectedObjects;
    } else if( eventData && eventData.selections && eventData.selections.length > 0 ) {
        parametersTableCtx.parentObjects = eventData.selections;
    } else if( selection && selection.length > 0 ) {
        parametersTableCtx.parentObjects = selection;
        eventBus.publish( 'closeAttrMapping' );
    } else if( selection.nodeModels && selection.nodeModels.length > 0 ) {
        parametersTableCtx.parentObjects = _.map( selection.nodeModels, 'modelObject' );
    } else {
        parametersTableCtx.parentObjects = [];
    }
    return {
        parametersTable: parametersTableCtx
    };
};

/**
 * Update the display names
 *
 */
export let updateDisplayNames = function( eventData, paramTableCtx ) {
    if( eventData.vmc ) {
        _.forEach( eventData.modifiedObjects, function( mo ) {
            _.forEach( eventData.vmc.loadedVMObjects, function( vmo ) {
                var underlyingObjects = adapterSvc.getAdaptedObjectsSync( [ vmo ] );
                //Update the display name
                if( underlyingObjects && underlyingObjects.length > 0 && underlyingObjects[ 0 ].props && underlyingObjects[ 0 ].props.object_name ) {
                    var newDisplayName = underlyingObjects[ 0 ].props.object_name.uiValues[ 0 ];
                    if( vmo.displayName !== newDisplayName ) {
                        vmo.displayName = newDisplayName;
                    }
                }
            } );
        } );
    } else {
        //if compare mode is on, and object is updated, we need to do the complete client refresh
        var comapreParameters = _.get( paramTableCtx, 'options.compareParameters', false );
        if( comapreParameters ) {
            eventBus.publish( 'uniformParamTable.plTable.clientRefresh' );
        }
    }
    return false;
};

/**
 * Method to select the parameters in uniform parameters table
 * @param {Object} uwDataProvider the data provider object for parameter table
 * @param {Array} objectsToSelect the array of objects to select in table
 */
export let setSelection = function( uwDataProvider, objectsToSelect, selectNodes ) {
    if( uwDataProvider ) {
        var selModel = uwDataProvider.selectionModel;
        if( objectsToSelect ) {
            var vmObjects = uwDataProvider.viewModelCollection.loadedVMObjects;
            var attributesToSelect = getViewModelObjectsForAttributes( vmObjects, objectsToSelect );
        } else if( selectNodes ) {
            attributesToSelect = selectNodes;
        }
        selModel.setSelection( attributesToSelect );
    }
};

/**
 * Method to clear the selection in uniform parameter table
 */
export let clearSelections = function() {
    eventBus.publish( 'uniformParamTable.selectNodes', [] );
};

/**
 * Method to find the common VM tree nodes
 * @param {TreeNode} nodesToExpand the tree nodes to expand
 */
function getCommonVMParentTreeNodes( vmObjects, vmObjectCommonParentsToExpand ) {
    var vmObjectParentToExpand = [];
    for( var i = 0; i < vmObjects.length; i++ ) {
        var isPresent = false;
        var parentVmNode = vmObjects[ i ].parentNode;
        while( !isPresent && parentVmNode ) {
            if( vmObjectParentToExpand.indexOf( parentVmNode ) < 0 ) {
                // Not present
                parentVmNode = parentVmNode.parentNode;
            } else {
                isPresent = true;
                break;
            }
        }

        if( !isPresent ) {
            vmObjectParentToExpand.push( vmObjects[ i ] );
        }
    }

    for( var j = 0; j < vmObjectParentToExpand.length; ++j ) {
        if( vmObjectParentToExpand[ j ].levelNdx === 0 ) {
            vmObjectCommonParentsToExpand.push( vmObjectParentToExpand[ j ] );
            break;
        } else {
            var parentVmNode2 = vmObjectParentToExpand[ j ].parentNode;
            vmObjectCommonParentsToExpand.push( parentVmNode2 );
        }
    }
}

/**
 * @param {Object} data eventData
 * Method to reload Or Expand Uniform Param Table
 * (Supports Show Elements View only)
 */
export let reloadOrExpandUniformParamTable = function( eventData, paramTableCtx, vmNodes ) {
    var vmObjects = _.get( paramTableCtx, 'selectedObjects', [] );
    var selectedElementsFromProxy = _.get( paramTableCtx, 'selectedElementsFromProxy', [] );
    var uidToVMNodeMap = new Map();

    _.forEach( vmNodes, function( vmo ) {
        uidToVMNodeMap.set( vmo.uid, vmo );
    } );

    //When there is no selection in table, expand PWA elements default.
    if( eventData && eventData.forceReloadTable || vmObjects.length === 0 ) {
        reloadUniformParamTable( paramTableCtx );
        doPostProcessingAfterTableReload( paramTableCtx );
        return;
    }
    var nodesToSelect = [];
    if( eventData && eventData.expandCommonParent ) {
        var vmObjectCommonParentsToExpand = [];
        getCommonVMParentTreeNodes( vmObjects, vmObjectCommonParentsToExpand );
        vmObjects = vmObjectCommonParentsToExpand;
        if( vmObjectCommonParentsToExpand.length === 1 && vmObjectCommonParentsToExpand.indexOf( vmObjects[ 0 ] ) >= 0 ) {
            //This means this top common parent node which needs to be get refreshed
            var eventDataReload = {
                forceReloadTable: true
            };
            eventBus.publish( 'uniformParamTable.reloadTable', eventDataReload );
            return;
        }
    } else if( selectedElementsFromProxy.length === 0 ) {
        var vmObjectsTemp = [];
        //When there is/are only param selections in table, get the parent view model tree nodes and expand them.
        for( var i = 0; i < vmObjects.length; i++ ) {
            //fetch parentVMNode
            var parentVmNode = uidToVMNodeMap.get( vmObjects[ i ].parentNode );

            if( vmObjectsTemp.indexOf( parentVmNode ) < 0 ) {
                vmObjectsTemp.push( parentVmNode );
                nodesToSelect.push( parentVmNode );
            }
        }
        vmObjects = vmObjectsTemp;
    }
    //When there is/are only element selections in table, then expand selected view model tree nodes.
    for( var i = 0; i < vmObjects.length; i++ ) {
        if( vmObjects[ i ].isExpanded === undefined || vmObjects[ i ].isExpanded ) {
            vmObjects[ i ].isExpanded = false;
            eventBus.publish( 'uniformParamTable.plTable.toggleTreeNode', vmObjects[ i ] );
        }
    }
    expandAllNodes( vmObjects );
    if( nodesToSelect.length === 1 ) {
        var selectNodes = {
            selectNodes: nodesToSelect
        };
        eventBus.publish( 'uniformParamTable.selectNodes', selectNodes );
    }
};

/**
 * Method to expand given tree nodes
 * @param {TreeNode} nodesToExpand the tree nodes to expand
 */
function expandAllNodes( nodesToExpand ) {
    setTimeout( () => {
        for( var x = 0; x < nodesToExpand.length; x++ ) {
            delete nodesToExpand[ x ].__expandState;
            delete nodesToExpand[ x ].childVmNodes;
            delete nodesToExpand[ x ].children;
            eventBus.publish( 'uniformParamDataProvider.expandTreeNode', { parentNode: nodesToExpand[ x ] } );
        }
    }, 200 );
}

/**
 * Method to expand node in uniform parameter table
 * @param {Object} uwDataProvider the data provider object for parameter table
 * @param {Array} objectsToExpand the array of objects to expand in table
 */
export let expandNodes = function( uwDataProvider, objectsToExpand ) {
    if( uwDataProvider ) {
        var vmObjects = uwDataProvider.viewModelCollection.loadedVMObjects;
        vmObjects = getViewModelObjectsForAttributes( vmObjects, objectsToExpand );
        for( var i = 0; i < vmObjects.length; i++ ) {
            eventBus.publish( uwDataProvider.name + '.expandTreeNode', {
                parentNode: vmObjects[ i ]
            } );
        }
    }
};

var getAttributeUid = function( attribute ) {
    if( attribute.modelType && attribute.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        var undelryingObject = adapterSvc.getAdaptedObjectsSync( [ attribute ] );
        return undelryingObject[ 0 ].uid;
    }
    return attribute.uid;
};

/**
 * Method to get corresponding view model objects for attribute
 * @param {Object} viewModelObjects the view model objects in table
 * @param {Object} attributes the attribute to filter
 * @returns {Array} the filtered view model objects
 */
var getViewModelObjectsForAttributes = function( viewModelObjects, attributes ) {
    if( viewModelObjects && viewModelObjects.length > 0 && attributes && attributes.length > 0 ) {
        return viewModelObjects.filter( function( vmObject ) {
            for( var i = 0; i < attributes.length; i++ ) {
                if( attributes[ i ].uid && vmObject.props ) {
                    var vmObjectUid = vmObject.props.att1SourceAttribute.dbValue;
                    var attributeUid = getAttributeUid( attributes[ i ] );
                    if( vmObjectUid === attributeUid ) {
                        return true;
                    }
                }
            }
            return false;
        } );
    }
    return [];
};

/**
 * Post Processing After Table Reload
 *
 */
export let doPostProcessingAfterTableReload = function( parametersTable ) {
    if( _.get( parametersTable, 'selectedObjects', undefined ) ) {
        let parametersTableCtx = { ...parametersTable.value };
        delete parametersTableCtx.selectedObjects;
        parametersTable.update( parametersTableCtx );
    }
};

/**
 * Uninitialize the parameters table
 *
 */
export let unInitParametersTable = function( paramTableCtx ) {
    // clear the server cache if needed
    var hasServerCache = _.get( paramTableCtx, 'options.hasServerCache', false );
    if( hasServerCache ) {
        return _clearServerCache( paramTableCtx );
    }
    eventBus.publish( 'closeAttrMapping' );
    eventBus.publish( 'Att1InlineAuthoring.removeEditHandler' );
};

/**
 * Set ctx.parametersTable.canStartEdit after table nodes loaded for uniform prameters table
 *
 */
export let tableLoaded = function( dataProvider, parametersCount, parametersTable, selection ) {
    if( parametersCount > 0 ||  dataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        let parametersTableCtx = { ...parametersTable.value };
        var canStartEdit = false;
        for( var vmo in dataProvider.viewModelCollection.loadedVMObjects ) {
            var loadedvmo = dataProvider.viewModelCollection.loadedVMObjects[ vmo ];
            if( loadedvmo.props !== undefined && loadedvmo.props.is_modifiable !== undefined && loadedvmo.props.is_modifiable.dbValues[ 0 ] === '1' ) {
                canStartEdit = true;
                break;
            }

            /*
            * Due to changes to avoid reload of parameters table, is_modifiable property on AttributeAlignmentProxy is not getting set.
            * If is_modifiable property is not set, it will cause 2 issues
            *    1. Parameter start edit command is not visible when parameter added in Empty table
            *    2. If start edit command is visible beacuse of other prameters then on click of start edit added parameter won't go in edit mode
            */
            if ( loadedvmo.props && loadedvmo.props.att1SourceAttribute ) {
                var sourceAttributeUID = loadedvmo.props.att1SourceAttribute.dbValues[0];
                if ( sourceAttributeUID ) {
                    var sourceAttribute = cdm.getObject( sourceAttributeUID );
                    if ( sourceAttribute && sourceAttribute.props.is_modifiable && sourceAttribute.props.is_modifiable.dbValues[0] === '1' ) {
                        loadedvmo.props.is_modifiable = sourceAttribute.props.is_modifiable;
                        loadedvmo.props.is_modifiable.dbValue = true;
                        canStartEdit = true;
                        break;
                    }
                }
            }
        }
        var vmObjects = _.get( parametersTable, 'selectedObjects', [] );
        if( parametersTable.parametersTableViewMode && parametersTable.parametersTableViewMode.viewModeContext === 'showChildLines' && vmObjects.length === 0 ) {
            var attributesToExpand = {
                attributesToExpand: selection
            };
            eventBus.publish( 'uniformParamTable.expandNodes', attributesToExpand );
        }
        parametersTableCtx.canStartEdit = canStartEdit;
        if ( parametersTableCtx.restoreSelection ) {
            for( var vmo in dataProvider.viewModelCollection.loadedVMObjects ) {
                var source = dataProvider.viewModelCollection.loadedVMObjects[ vmo ];
                source = cdm.getObject( source.id );
                if ( source.props && source.props.att1SourceAttribute && source.props.att1SourceAttribute.dbValues[0] === parametersTableCtx.restoreSelection ) {
                    var selectNodes = {
                        selectNodes:  [ source ]
                    };
                    eventBus.publish( 'uniformParamTable.selectNodes', selectNodes );
                }
            }
            parametersTableCtx.restoreSelection = undefined;
        }
        parametersTable.update( parametersTableCtx );
    }
};

/**
 * Clear the server cache if needed
 */
var _clearServerCache = function( paramTableCtx ) {
    var deferred = awPromiseSvc.instance.defer();
    var soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: paramTableCtx.clientScopeURI
        },
        searchInput: {
            maxToLoad: 1,
            maxToReturn: 1,
            providerName: paramTableCtx.dataProvider,
            searchCriteria: {
                requestId: paramTableCtx.requestId,
                clearCache: 'true'
            },
            startIndex: 0
        }
    };

    soaSvc.postUnchecked( 'Internal-AWS2-2023-06-Finder', 'performSearchViewModel5', soaInput ).then(
        function( response ) {
            if( response.searchResultsJSON ) {
                response.searchResults = JSON.parse( response.searchResultsJSON );
                delete response.searchResultsJSON;
            }
            deferred.resolve();
        } ).catch( function( error ) {
        deferred.reject( error );
    } );

    return deferred.promise;
};

/**
 * Method to make child parameters non editable
 *
 * @param {*} eventData
 */
export let updateChildParametersNonEditable = function( eventData ) {
    var loadedObjects;
    if( eventData && eventData.state === 'starting' && eventData.dataSource.viewModelCollection && eventData.dataSource.viewModelCollection.loadedVMObjects.length > 0 ) {
        loadedObjects = eventData.dataSource.viewModelCollection.loadedVMObjects;
    }
    _.forEach( loadedObjects, function( vmo ) {
        if( vmo.props.att1Parent && vmo.props.att1Parent.dbValues[ 0 ] !== '' ) {
            _.forEach( vmo.props, function( propValue, propName ) {
                propValue.isEditable = false;
            } );
        }
    } );
};

/**
 * Method to make child parameters cells non editable
 *
 * @param {object} eventData - the event data object
 */
export let updateCellPropNonEditable = function( eventData ) {
    if( eventData && eventData.vmo && eventData.vmo.props.att1Parent && eventData.vmo.props.att1Parent.dbValues[ 0 ] !== '' ) {
        _.forEach( eventData.vmo.props, function( propValue, propName ) {
            propValue.isEditable = false;
        } );
    }
};

/**
 * Method to make override column non editable
 *
 * @param {*} eventData
 */
export let updateOverrideCellPropNonEditable = function( eventData ) {
    if( eventData && eventData.vmo && eventData.vmo.props ) {
        _.forEach( eventData.vmo.props, function( propValue, propName ) {
            if( propName === 'REF(att1SourceAttribute,Att0MeasurableAttribute).REF(att1ContextObject,WorkspaceObject).object_name' ) {
                propValue.isEditable = false;
            }
        } );
    }
};

/**
 * Reload the Uniform Parameter Table and update the container height.
 */
export let reloadUniformParamTable = function( paramTableCtx, eventData, dataProvider ) {
    if( eventData && eventData.reusable ) {
        if( _.isEmpty( eventData.requestId ) && _.isEmpty( eventData.paramTableKey ) || eventData.requestId === paramTableCtx.requestId || eventData.paramTableKey === paramTableCtx.paramTableKey ) {
            dataProvider.resetDataProvider();
            dataProvider.selectionModel.selectNone();
        }
    } else if( eventData && eventData.requestId ) {
        if( eventData.requestId === paramTableCtx.requestId ) {
            dataProvider.resetDataProvider();
            dataProvider.selectionModel.selectNone();
        }
    }else {
        var containerHeight = _.get( paramTableCtx, 'containerHeight', 450 );
        eventBus.publish( 'uniformParamTable.plTable.containerHeightUpdated', containerHeight );

        setTimeout( () => { eventBus.publish( 'uniformParamTable.plTable.reload' ); }, 100 );
    }
};

export let handleSavedEditStateChange = function( data, parametersTable ) {
    var editHandlerEventData = data.eventData;
    var isUpdateRequired = false;
    if ( editHandlerEventData.state === 'saved' &&
         editHandlerEventData.dataSource &&
         editHandlerEventData.dataSource.dataProviders &&
         editHandlerEventData.dataSource.dataProviders.uniformParamDataProvider ) {
        var columns = editHandlerEventData.dataSource.dataProviders.uniformParamDataProvider.columnConfig.columns;
        for ( var i = 0; i < columns.length; i++ ) {
            var column = columns[i];
            if ( column.propertyName === 'REF(att1Objective,Att0Objective).att0Target' && column.hiddenFlag === false ) {
                isUpdateRequired = true;
                break;
            }
        }
        if( isUpdateRequired ) {
            var objectsMap = new Map();
            var parametersToUpdate = data.eventMap['cdm.updated'];
            for ( let index = 0; index < parametersToUpdate.updatedObjects.length; index++ ) {
                var selected = parametersToUpdate.updatedObjects[index];
                objectsMap.set( selected.uid, '' );
            }
            updateTargetColumnDetails( objectsMap, editHandlerEventData.dataSource.dataProviders.uniformParamDataProvider );
        }
    }
};

export const reloadRevisedObjects = function( eventdata ) {
    for( var i = 0; i < eventdata.selectedObjects.length; i++ ) {
        var element = cdm.getObject( eventdata.selectedObjects[ i ].dbValue );
        var revId = element.props.awb0Archetype.dbValues[0];
        for( let j = 0; j < eventdata.revisedObjects.length; j++ ) {
            var uid =  eventdata.revisedObjects[ j ].originalObject.uid;
            if( uid === revId ) {
                let inputData = {
                    input: {
                        element: {
                            uid:eventdata.selectedObjects[ i ].dbValue
                        },
                        workspaceObject: {
                            uid: eventdata.revisedObjects[ j ].objectCopy.uid,
                            type: eventdata.revisedObjects[ j ].objectCopy.type
                        },
                        productContext: {
                            uid: appCtxSvc.getCtx( 'aceActiveContext.context.currentState.pci_uid' ),
                            type: 'Awb0ProductContextInfo'
                        }
                    }
                };
                soaSvc.post( 'Internal-ActiveWorkspaceBom-2021-06-OccurrenceManagement', 'updateContentBasedOnRevision2', inputData );
                break;
            }
        }
    }
};

export let updateTargetColumnDetails = function( parametersToUpdate, dataProvider ) {
    var vmObjects = dataProvider.viewModelCollection.loadedVMObjects;
    if ( vmObjects && vmObjects.length > 0 ) {
        for ( let index = 0; index < vmObjects.length; index++ ) {
            var selected = vmObjects[index];
            if ( parametersToUpdate[selected.id] !== undefined ||  parametersToUpdate[selected.id] !== null ) {
                var propName = 'intermediateObjectUids';
                var targetProp = selected.props['REF(att1Objective,Att0Objective).att0Target'];
                if ( targetProp ) {
                    var propValue = [];
                    if ( selected.props.att1Objective ) {
                        var objectiveUid = selected.props.att1Objective.dbValue;
                        if ( objectiveUid === '' || objectiveUid === null || objectiveUid === undefined ) {
                            targetProp[propName] = [];
                            targetProp.isEditable = false;
                            targetProp.displayValues = [];
                            targetProp.uiValues = [];
                            targetProp.uiValue = '';
                            targetProp.isPropertyModifiable = false;
                        } else {
                            propValue = [ objectiveUid ];
                            targetProp[propName] = propValue;
                            targetProp.isEditable = true;
                            targetProp.isPropertyModifiable = true;
                        }
                    }
                }
            }
        }
    }
    eventBus.publish( 'uniformParamTable.refreshTable' );
};


/**
 * Method to clear selection of parameter table
 * @param {*} dataProvider
 * @param {*} activeObjectSet
 */
export const clearParameterTableSelection = function( dataProvider, activeObjectSet ) {
    if( activeObjectSet !== dataProvider.name ) {
        dataProvider.selectionModel.selectNone();
    }
};

/**
 * Method to handle when Delta Response is true with No change in PWA. Example : When you change Variant rule from
 * Header section, and you need to react to this change.
 * @param {object} eventMap Event Map
 */
export const handleConfigurationChangeInACE = ( eventMap, subPanelContext  ) => {
    /*
    As of now, Ace dosen't provide any specific event which gets fired when variant is changed nor they provide
    any property on ctx when we can use to leverage onUpdate hook.
    As per discussion with ACE, they suggested to use cdm.relatedModified along with eventData.forceReloadAceSwa
    to detect change in Variant rule and use it as metric to reload the table.
    Check : LCS-751054
    */

    const eventData = eventMap[ 'cdm.relatedModified' ];
    if( eventData?.forceReloadAceSWA === true ) {
        let productContextObjects = [];
        let rootElements = [];
        let parametersTableCtxTemp = { ...subPanelContext.parametersTable.value };
        updateParameterTableCtxForProductInfo( subPanelContext, productContextObjects, rootElements );

        parametersTableCtxTemp.productContextObjects = productContextObjects;
        parametersTableCtxTemp.rootElements = rootElements;

        subPanelContext.parametersTable.update( parametersTableCtxTemp );
        eventBus.publish( 'uniformParamTable.plTable.reload' );
    }
};


const updateParameterTableCtxForProductInfo = ( subPanelContext, productContextObjects, rootElements ) => {
    if( appCtxSvc.ctx.sublocation.nameToken === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' ) {
        _getProductContextOrRootElementObjects( subPanelContext, productContextObjects, rootElements );
    }
};


/**
 * Method to handle selection change in NX object created from parameters.
 * @param {*} eventData event data
 */
export const handleHostingParaSelectionChange = ( eventData ) => {
    if( eventData.selected ) {
        var paramsToselect = [];
        for( var i = 0; i < eventData.selected.length; i++ ) {
            paramsToselect.push( { uid:eventData.selected[i] } );
        }
        var selectNodeEventData = { attributesToSelect:paramsToselect };
        eventBus.publish( 'uniformParamTable.selectNodes', selectNodeEventData );
    }
};

/**
 * Method to reload the parameter table when new revision of existing parent is created in PWA.
 * @param {object} eventMap Event Map
 */
export const handleRevisionChangeInACE = ( eventMap ) => {
    const eventData = eventMap[ 'Awp0ShowSaveAs.saveAsComplete' ];
    // Check to reload the table only for Revise and not for SaveAs.
    if( eventData?.scope?.ctx?.REVISE_PANEL_CONTEXT ) {
        setTimeout( () => { eventBus.publish( 'uniformParamTable.plTable.reload' ); } );
    }
};

export let updateCtxOnClosePanel = function( parametersTable ) {
    if( parametersTable && parametersTable.isParameterWidePanelOpen ) {
        let parametersTableCtx = { ...parametersTable.value };
        parametersTableCtx.isPanelClosed = true;
        parametersTable.update( parametersTableCtx );
    }
};

export let updateCtxOnOpenPanel = function( parametersTable ) {
    if( parametersTable && parametersTable.isParameterWidePanelOpen ) {
        let parametersTableCtx = { ...parametersTable.value };
        parametersTableCtx.isPanelOpened = true;
        parametersTable.update( parametersTableCtx );
    }
};

export default exports = {
    initParametersTableForXRT,
    initParametersTableForSync,
    loadParamTreeColumns,
    loadParamTreeData,
    loadParamTreeProperties,
    syncParamSelections,
    updateDisplayNames,
    doPostProcessingAfterTableReload,
    unInitParametersTable,
    showChildrenParametersSelected,
    processSelectionChangeAction,
    setSelection,
    clearSelections,
    expandNodes,
    reloadOrExpandUniformParamTable,
    tableLoaded,
    setCellRenderers,
    updateChildParametersNonEditable,
    updateCellPropNonEditable,
    updateOverrideCellPropNonEditable,
    reloadUniformParamTable,
    reloadRevisedObjects,
    clearParameterTableSelection,
    setFlagsForWidePanel,
    updateTargetColumnDetails,
    handleSavedEditStateChange,
    handleConfigurationChangeInACE,
    handleHostingParaSelectionChange,
    handleRevisionChangeInACE,
    updateCtxOnClosePanel,
    updateCtxOnOpenPanel
};


