// Copyright (c) 2022 Siemens

/**
 * @module js/Att1InlineAuthoringHandler
 */
import appCtxService from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import awTableSvc from 'js/awTableService';
import dataSourceService from 'js/dataSourceService';
import editHandlerSvc from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import iconSvc from 'js/iconService';
import messagingService from 'js/messagingService';
import Att1InlineAuthoringEditService from 'js/Att1InlineAuthoringEditService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import parsingUtils from 'js/parsingUtils';
import _ from 'lodash';

const nameProp = 'REF(att1SourceAttribute,Att0MeasurableAttribute).object_name';
const objectProp = 'REF(att1SourceAttribute,Att0MeasurableAttribute).object_string';
const typeProp = 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0AttrDefRev,Att0AttributeDefRevision).att0AttrType';
const paramDefProp = 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0AttrDefRev,Att0AttributeDefRevision).object_name';
const uomProp = 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Uom';
const dataTypeSensitive = [
    'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Goal',
    'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Min',
    'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Max',
    'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0AsUsedValue'
];

let exports = {};
let CONFIG_CONTEXT_KEY = 'ParameterTableEditContext';

/**
 * Returns View Model Tree Node for the input model object
 * @param {Object} modelObj - The model object
 * @param {Object} parentNode - The parent node for modelObj
 * @returns {Object} - View Model Tree Node object
 */
let _createViewModelTreeNodeUsingVMO = function( modelObj, parentNode ) {
    // Get child node level index
    let childlevelIndex = 0;
    if( parentNode ) {
        childlevelIndex = parentNode.levelNdx + 1;
    }

    // Create view model tree node
    let iconURL = iconSvc.getTypeIconURL( modelObj.type );
    let childIdx = parentNode.childNdx;

    // Get display name
    let displayName = '';

    let vmNode = awTableSvc.createViewModelTreeNode( modelObj.uid, modelObj.type, displayName, childlevelIndex, childIdx, iconURL );

    vmNode.isLeaf = true;
    vmNode.getId = function() {
        return this.uid;
    };
    vmNode.parentUid = parentNode.uid;
    vmNode.isInlineRow = true;

    return vmNode;
};

/**
 * Add inline row to parent node
 * @param {Object} parentNode - parent node object under which inline row to be added
 * @param {Object} childNode - inline row view model object to be added under parent node
 * @param {Object} childNodeIndex - index under parent node at which child node to be added
 */
let _addChildToParentsChildrenArray = function( parentNode, childNode, childNodeIndex ) {
    if( parentNode ) {
        if( !parentNode.children || parentNode.children.length === 0 ) {
            parentNode.expanded = true;
            parentNode.isExpanded = true;
            parentNode.children = [];
        }
        childNodeIndex < parentNode.children.length ? parentNode.children.splice( childNodeIndex, 0, childNode ) :
            parentNode.children.push( childNode );
        parentNode.isLeaf = false;
        parentNode.totalChildCount = parentNode.children.length;
    }
};

/**
 * Add inline row into View Model Object list
 * @param {Object} treeDataProvider - tree Data Provider
 * @param {Object} parentNode - parent node object under which inline row to be added
 * @param {Object} childVMO - inline row view model object to view model object collection
 */
let _insertInlineRow = function( treeDataProvider, parentNode, childVMO ) {
    // Insert the new treeNode in the viewModelCollection after selected row or at the end
    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let selectedIndex = treeDataProvider.getSelectedIndexes();
    let expectedInlineRowIdx = selectedIndex.length === 1 ? selectedIndex[0] + 1 : 0;
    let selected = treeDataProvider.selectedObjects;
    if ( selected.length === 1 && selected[0].children ) {
        expectedInlineRowIdx += selected[0].children.length;
    }
    viewModelCollection.splice( expectedInlineRowIdx, 0, childVMO );
    // Add the new treeNode to the parentVMO and update view model collection
    _addChildToParentsChildrenArray( parentNode, childVMO, expectedInlineRowIdx );
    treeDataProvider.update( viewModelCollection );
    treeDataProvider.setSelectionEnabled( true );
};

/**
 * Creates a data source for edit handler
 * @param {Object} dataProviders - data providers
 * @return {Object} dataSource instance
 */
let _createDatasource = function( dataProviders ) {
    return dataSourceService.createNewDataSource( {
        dataProvider: dataProviders
    } );
};


export let checkForDataTypeTemplate = function( event, dataProvider, typeTemplates ) {
    var childVMO;
    var selectedValue = event.newType;
    if ( selectedValue === undefined ) {
        childVMO = dataProvider.selectedObjects[0];
        if ( event.selected.length === 0 ) {
            selectedValue = childVMO.props[ typeProp ].dbValue;
        } else {
            selectedValue = event.selected[0].propInternalValue;
        }
    } else {
        childVMO = dataProvider.viewModelCollection.getViewModelObjects( event.uid )[0];
    }
    let eventData = {
        dataType: selectedValue,
        vmo: childVMO
    };
    if ( typeTemplates[ selectedValue ] === undefined ) {
        eventBus.publish( 'Att1InlineAuthoring.getParameterVMOObjectsAndApply', eventData );
    } else if ( selectedValue !== childVMO.targetObjectType ) {
        eventBus.publish( 'Att1InlineAuthoring.updateGMMForSelectedDataType', eventData );
    }
    return {
        inlineCreateDataType: selectedValue,
        inlineCreateClientId: selectedValue
    };
};

export let checkForParameterDefTemplate = function( event, dataProvider, typeTemplates ) {
    var childVMO;
    var selectedValue = event.newParamDef;
    if ( selectedValue === undefined ) {
        selectedValue = event.selected[0].propInternalValue;
        childVMO = dataProvider.selectedObjects[0];
    } else {
        childVMO = dataProvider.viewModelCollection.getViewModelObjects( event.rowUid )[0];
    }
    let eventData = {
        dataType: selectedValue,
        vmo: childVMO
    };
    if ( typeTemplates[ selectedValue ] === undefined ) {
        eventBus.publish( 'Att1InlineAuthoring.getParameterVMOObjectsAndApply', eventData );
    } else if ( selectedValue !== childVMO.targetParamDef ) {
        eventData.paramDefFound = true;
        eventBus.publish( 'Att1InlineAuthoring.getParameterVMOObjectsAndApply', eventData );
    }
    var paramDef = {
        type: 'Att0AttributeDef',
        uid: selectedValue
    };
    return {
        inlineParameterDefRev: paramDef,
        inlineCreateClientId: selectedValue
    };
};

export let updateGMMForSelectedDataType = function(  unsavedRows, selectedValue, vmo, dataProvider, typeTemplates, createParamWithDef ) {
    let newUnsavedRows = [ ...unsavedRows ];
    let useParamDefs = createParamWithDef !== 'false';
    let target = useParamDefs ? vmo.targetParamDef : vmo.targetObjectType;
    var childVMO = vmo;
    let template = typeTemplates[ selectedValue ];
    for ( var i = 0; i < newUnsavedRows.length; i++ ) {
        let row = newUnsavedRows[i];
        if ( row.viewModelObject.id === childVMO.uid && selectedValue !== target ) {
            // reset cells where the property does not apply to the new type
            for ( var j = 1; j < dataProvider.columnConfig.columns.length; j++ ) {
                let name = dataProvider.columnConfig.columns[j].propertyName;
                if ( !template.props[ name ] ) {
                    resetProperty( childVMO, name );
                }
            }

            // Reset cells whose input type changes when data type changes
            let dataType = template.props[ typeProp ].dbValues[0];
            _.forEach( childVMO.props, function( prop ) {
                if ( template.props[ prop.propertyName ] && dataTypeSensitive.includes( prop.propertyName ) ) {
                    resetProperty( childVMO, prop.propertyName );
                    setInputType( childVMO, prop.propertyName, dataType );
                }
            } );

            // Apply new template propterties to row
            for( const key of Object.keys( template.props )  ) {
                updateProperty( childVMO, template.props[ key ] );
            }

            if ( useParamDefs ) {
                childVMO.targetParamDef = selectedValue;
                childVMO.props[ paramDefProp ].dbValues[0] = selectedValue;
            } else {
                childVMO.targetObjectType = selectedValue;
                childVMO.props[ uomProp ].isEditable = true;
                if ( childVMO.props[ paramDefProp ] ) {
                    childVMO.props[ paramDefProp ].isRequired = false;
                    childVMO.props[ paramDefProp ].isEditable = false;
                }
            }
            childVMO.props.att1AttrInOut.isEditable = true;
            newUnsavedRows[i].viewModelObject = childVMO;
            dataProvider.update( dataProvider.viewModelCollection.loadedVMObjects );
        }
    }
    return {
        unsavedRows: newUnsavedRows
    };
};

let updateProperty = function( vmo, templateProp ) {
    let prop = vmo.props[ templateProp.propertyName ];
    if ( prop && !prop.dirty ) {
        // remove fields that should not be overwritten
        prop.dataType = templateProp.type;
        delete templateProp.type;
        delete templateProp.parentUid;
        delete prop.isModifiable;
        _.merge( prop, templateProp );
        prop.isEditable = prop.isModifiable === true;
        if ( !prop.isEditable ) {
            prop.isRequired = false;
        }
        if ( templateProp.dbValues !== undefined ) {
            prop.dbValue = templateProp.dbValues[0];
            prop.uiValue = templateProp.uiValues[0];
        }else if( templateProp.propertyName === uomProp ) {
            prop.dbValue = null;
            prop.uiValue = '';
        }
    }
};

let resetProperty = function( vmo, property ) {
    if ( vmo.props[ property ] ) {
        vmo.props[ property ].isEditable = false;
        vmo.props[ property ].dbValue = '';
        vmo.props[ property ].dbValues = [];
        vmo.props[ property ].uiValue = '';
        vmo.props[ property ].uiValues = [];
        vmo.props[ property ].isEditable = false;
        vmo.props[ property ].dirty = false;
        vmo.props[ property ].valueUpdated = false;
    }
};

let setInputType = function( vmo, property, type ) {
    var inputType = 'TEXT';
    switch ( type ) {
        case 'Double':
            inputType = 'DOUBLE';
            break;
        case 'Integer':
            inputType = 'INTEGER';
            break;
        case 'Boolean':
            inputType = 'BOOLEAN';
            break;
        case 'String':
            inputType = 'TEXT';
            break;
        case 'Point':
            inputType = 'TEXT';
            break;
    }
    if ( vmo.props[ property ] ) {
        vmo.props[ property ].inputType = inputType;
        vmo.props[ property ].type = inputType;
    }
};

/**
 * Renders the inline row after creation.
 * @param {Object} targetObjectType - target Object Type
 * @param {Object} parentNode - parent Node
 * @param {Object} unsavedRowList - the unsaved Row List
 * @param {Object} newRowCacheMap - the new row CacheMap
 * @param {Object} treeDataProvider - the treeDataProvider
 * @param {String} inlineAuthoringHandlerContext - the context,
 * @param {String} createParamWithDef - 'true' if Parameter Definitions are used
 * @param {Object} i18n localizations
 * @returns {Object} - Returns updated unsavedRowList
 */
export let renderInlineRow = function( targetObjectType, parentNode, unsavedRowList, newRowCacheMap, treeDataProvider, inlineAuthoringHandlerContext, createParamWithDef, i18n, table ) {
    let deferred = awPromiseService.instance.defer();

    let getViewModelForCreateResponse = {};
    let serverVMO = _.cloneDeep( newRowCacheMap[ targetObjectType ] );

    // set unique id for each model object
    serverVMO.uid = Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 ) +
            Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
    serverVMO.id = serverVMO.uid;

    // Replace json string with the model object
    getViewModelForCreateResponse.viewModelObject = serverVMO;
    getViewModelForCreateResponse.parentNode = parentNode.uid;
    unsavedRowList.push( getViewModelForCreateResponse );

    // Create VMO for inline row
    let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( serverVMO, 'EDIT' );
    let updatedVMO = viewModelObjectSvc.createViewModelObject( vmo, 'EDIT', null, serverVMO );

    updatedVMO.setEditableStates( true, true, true );
    updatedVMO.iconURL = 'assets/image/typeMeasurableAttribute48.svg';
    updatedVMO.typeIconURL = 'assets/image/typeMeasurableAttribute48.svg';
    let childVMO = _createViewModelTreeNodeUsingVMO( updatedVMO, parentNode );
    childVMO.displayName = i18n.newParameterName + ' ' + unsavedRowList.length;

    _.merge( childVMO, updatedVMO );
    childVMO.targetObjectType = targetObjectType;
    let useParamDefs = createParamWithDef === 'true';

    // Make sure LOV flag is set on LOV cells, there is a display issue if not set
    childVMO.props.att1AttrInOut.hasLov = true;
    childVMO.props[ uomProp ].hasLov = true;

    if ( childVMO.props[ paramDefProp ] ) {
        childVMO.props[ paramDefProp ].isRequired = useParamDefs;
        childVMO.props[ paramDefProp ].isEditable = useParamDefs;
        childVMO.props[ paramDefProp ].hasLov = true;
    }
    childVMO.isDummy = true;

    // Insert VMO into tree
    _insertInlineRow( treeDataProvider, parentNode, childVMO );

    // Set edit handler
    let dataProvider = treeDataProvider;
    editHandlerSvc.setEditHandler( Att1InlineAuthoringEditService, inlineAuthoringHandlerContext );
    editHandlerSvc.setActiveEditHandlerContext( inlineAuthoringHandlerContext );
    let dataSource = _createDatasource( dataProvider );
    Att1InlineAuthoringEditService.setDataSource( dataSource );

    let currentInlineAuthoringContext = { inlineAuthoringContext: {} };
    currentInlineAuthoringContext.inlineAuthoringContext.isInlineAuthoringMode = true;
    currentInlineAuthoringContext.requestId = table.requestId;

    // Update inline authoring mode in ctx
    let currentContext = appCtxService.getCtx( CONFIG_CONTEXT_KEY );
    for( const key of Object.keys( currentInlineAuthoringContext ) ) {
        currentContext[ key ] = currentInlineAuthoringContext[ key ];
    }
    appCtxService.updatePartialCtx( CONFIG_CONTEXT_KEY, currentContext );
    deferred.resolve( unsavedRowList );

    return deferred.promise;
};

/**
 * Cancels the edits by discarding all the unsaved rows and removes the edit handler
 */
export let cancelEdits = function() {
    eventBus.publish( 'Att1InlineAuthoring.discardAllUnsavedRows' );
};

/**
 * Saves the edits by trigegring the SOA call
 */
export let saveEdits = function() {
    eventBus.publish( 'Att1InlineAuthoring.saveInlineRow' );
};

/**
 * Returns list of properties visisble in the table.
 * @param {Object} data - the viewModel data
 * @returns {Object} - Returns the list of properties
 */
export let populateVisiblePropertyList = function( data ) {
    let propertyNames = [ 'object_string' ];
    _.forEach( data.dataProviders.treeDataProvider.columnConfig.columns, function( column ) {
        if( column.hiddenFlag !== undefined && column.hiddenFlag === false ) {
            propertyNames.push( column.propertyName );
        }
    } );
    propertyNames = _.uniq( propertyNames );
    return propertyNames;
};

/**
 * Resets inline VMO template cache
 * @returns {object} empty object to be set for inline row cache
 */
export let resetInlineDataCache = function() {
    return {
        newRowCacheMap: {},
        inlineCreateClientId: 'Double',
        inlineCreateDataType: 'Double',
        inlineParameterDefRev: ''
    };
};

/**
 * Updates inline row cache after partial success, keeps around only the still unsaved rows and also
 * returns the saved ones for further processing
 * @param {object} unsavedRows - unsaved Rows
 * @param {object} serviceData - service Data
 * @param {object} treeDataProvider - treeDataProvider
 * @returns {object} object containing the 2 sub arrays of saved and unsaved rows (one will stay, one will get processed)
 */
export let updateUnsavedRows = function( unsavedRows, serviceData, treeDataProvider ) {
    if ( unsavedRows.length === 0 || serviceData.partialErrors === undefined ) {
        return {};
    }
    let newUnsavedRows = [ ...unsavedRows ];
    let savedRows = [ ...unsavedRows ];
    let fatalError = false;
    if( unsavedRows && serviceData && serviceData.partialErrors ) {
        //get the new UnsavedRows array = old minus the rows created
        newUnsavedRows = unsavedRows.filter( function( inlineRow ) {
            return serviceData.partialErrors.some( function( partialError ) {
                let shouldStay = partialError.clientId === undefined || partialError.clientId === '' || partialError.clientId === inlineRow.viewModelObject.uid;
                // We only want to show failed rows for ERROR/FATAL Level i.e. level = 3 or 4
                // So checking error value level if it is info or warning we will skip showing failed rows.
                // user will get info/warning message popup though.
                if( partialError.errorValues[ 0 ].level < 3 ) {
                    shouldStay = false;
                } else if ( partialError.clientId === '' ) {
                    fatalError = true;
                }
                if( shouldStay ) {
                    let treeVMO = _getInlineRowByUid( treeDataProvider, inlineRow.viewModelObject.uid );
                    let msg = partialError.errorValues[ 0 ].message;
                    treeVMO.partialErrorText = msg;
                    inlineRow.partialErrorText = msg;
                }
                return shouldStay;
            } );
        } );
        savedRows = unsavedRows.filter( x => !newUnsavedRows.includes( x ) );
    }
    let failedUnsavedRows = newUnsavedRows.map( function( row ) {
        return { ...row };
    } );

    if ( savedRows.length > 0 ) {
        _.forEach( savedRows, function( row ) {
            var rowVmo = _getInlineRowByUid( treeDataProvider, row.viewModelObject.uid );
            rowVmo.isEditing = false;
            _.forEach( rowVmo.props, function( prop ) {
                prop.isPropInEdit = false;
                prop.isEditable = false;
            } );
        } );
        let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
        treeDataProvider.update( viewModelCollection );
        treeDataProvider.setSelectionEnabled( true );
    }

    // An error occurred that did not include info on which rows failed to save. Reload to ensure table is correct.
    if ( fatalError ) {
        eventBus.publish( 'Att1InlineAuthoring.discardUnsavedInlineAndReload' );
        return {
            unsavedRows: [],
            savedRows: [],
            failedUnsavedRows: []
        };
    }

    // Disable inline authoring mode when there are no unsaved or failedunsaved rows.
    // This will disable Save button implicitly.
    if( newUnsavedRows.length === 0 || failedUnsavedRows.length === 0 ) {
        let contextKey = CONFIG_CONTEXT_KEY;
        let clonedCtx = _.cloneDeep( appCtxService.getCtx( contextKey ) );
        clonedCtx.inlineAuthoringContext.isInlineAuthoringMode = false;
        appCtxService.updatePartialCtx( contextKey + '.inlineAuthoringContext.isInlineAuthoringMode', clonedCtx.inlineAuthoringContext.isInlineAuthoringMode );
    } else {
        eventBus.publish( 'uniformParamTable.plTable.clientRefresh' );
    }
    return {
        unsavedRows: newUnsavedRows,
        savedRows: savedRows,
        failedUnsavedRows: failedUnsavedRows
    };
};

/**
 * Give inline row by the give UID
 * @param {object} treeDataProvider Tree data provider
 * @param {Object} uid UID of the VMO to fetch from View Model Collection
 * @return {Object} - Returns inline row object for given uid
 */
let _getInlineRowByUid = function( treeDataProvider, uid ) {
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let inlineRowobjectIdx = viewModelCollection.findViewModelObjectById( uid );
    return viewModelCollection.getViewModelObject( inlineRowobjectIdx );
};

/**
 * Returns the create input objects for all unsaved rows
 * @param {Object} eventData - vmo and update value
 * @param {object} treeDataProvider - Tree data provider
 * @param {Object} widgetPropertyName - Widget property name
 *
 */
export let updateInlineRowVMOProperties = function( eventData, treeDataProvider, widgetPropertyName ) {
    let inlineRow = treeDataProvider.selectedObjects[ 0 ];
    //this is the selection case - make everything read only but the name col
    let existingParentNodeIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.uid );
    if( existingParentNodeIdx !== -1 ) {
        let row = treeDataProvider.getViewModelCollection().getViewModelObject( existingParentNodeIdx );

        //this is the add case - everything stays as it is or reverses to original
        if( !eventData.lovValue.mo && !eventData.lovValue.selected ) {
            if( !row.isAllocation ) {
                return;
            }
            //if we allocate before, we need to go back to the inline state of it
            let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( row.serverVMO, 'EDIT' );
            let updatedVMO = viewModelObjectSvc.createViewModelObject( vmo, 'EDIT', null, row.serverVMO );
            updatedVMO.props[ widgetPropertyName ] = row.props[ widgetPropertyName ];
            row.props = updatedVMO.props;
            row.setEditableStates( true, true, true );
        } else {
            let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( eventData.response.modelObjects[ eventData.lovValue.mo.uid ], 'EDIT' );
            let newInlineRow = viewModelObjectSvc.createViewModelObject( vmo, 'EDIT', null, eventData.response.modelObjects[ eventData.lovValue.mo.uid ] );
            row.isAllocation = true;
            // update serverUid property with actual persisted uid of object.
            // This will be consumed while preparing createInput for createAndAddObjects2 SOA
            row.serverUid = vmo.uid;
            row.displayName = vmo.props.object_string.dbValue;

            _.forEach( row.props, function( prop ) {
                if( prop.propertyName !== widgetPropertyName ) {
                    if( newInlineRow.props[ prop.propertyName ] ) {
                        _.merge( prop, newInlineRow.props[ prop.propertyName ] );
                    } else {
                        //the others should also move to read only state
                        prop.editable = false;
                        prop.isEditable = false;
                    }
                }
            } );
        }
    }

    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    treeDataProvider.update( viewModelCollection );
};

/**
 * Updates the view model collection based on response from createAndAddObjects2 SOA
 * @param {Object} savedRows - succesfully saved inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 * @param {object} soaResponse - Response from createAndAddObjects2 SOA
 * @param {object} selectSavedRows - select Saved Rows flag - false for the unsuccess use case, true for the success one
 * @returns {Object} - Returns the list of newly authored rows which needs to be selected
 */
export let postSaveHandler = function( savedRows, treeDataProvider, soaResponse, selectSavedRows ) {
    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let selectionMOList = [];

    if( selectSavedRows ) {
        treeDataProvider.selectionModel.setSelection( selectionMOList );
    }
    treeDataProvider.update( viewModelCollection );
    //remove the inline rows
    exports.removeInlineRowsAfterSave( savedRows, treeDataProvider );
    return selectionMOList;
};

/**
 * Removes the inline rows after save
 * @param {Object} savedRows - the array of rows to remove
 * @param {object} treeDataProvider - the tree data provider
 */
export let removeInlineRowsAfterSave = function( savedRows, treeDataProvider ) {
    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    //remove the inline rows
    _.forEach( savedRows, function( inlineRow ) {
        let existingInlineRowIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.viewModelObject.uid );
        if( existingInlineRowIdx !== -1 ) {
            viewModelCollection.splice( existingInlineRowIdx, 1 );
        }

        // Also remove entry from chilren array of parent node
        let existingParentNodeIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.parentNode.nodeUid );
        if( existingParentNodeIdx !== -1 ) {
            let parentVMO = treeDataProvider.getViewModelCollection().getViewModelObject( existingParentNodeIdx );
            if( parentVMO.children.length > 0 ) {
                let inlineRowIdxFromChildArray = parentVMO.children.findIndex( obj => obj.uid === inlineRow.viewModelObject.uid );
                if( inlineRowIdxFromChildArray !== -1 ) {
                    parentVMO.children.splice( inlineRowIdxFromChildArray, 1 );
                }
            }
        }
    } );
    treeDataProvider.update( viewModelCollection );
};

/**
 * Removes the unsaved selection plus all the underlaying children from unsavedRows array and view model
 *
 * @param {object} eventData - Event Data
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 * @returns {Object} - Returns the updated list of unsavedRows and failed unsaved rows
 */
export let removeUnsavedRows = function( eventData, unsavedRows, treeDataProvider ) {
    if( !eventData || !eventData.rows ) {
        return {};
    }
    let newUnsavedRowsResult = _removeUnsavedRows( eventData.rows, unsavedRows, treeDataProvider, false );
    let newUnsavedRows = newUnsavedRowsResult.unsavedRows;
    let newFailedUnsavedRows = newUnsavedRowsResult.failedUnsavedRows;
    //set selection back to parent
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let parentNode = treeDataProvider.topTreeNode;
    //remove selected row from children of the parent
    treeDataProvider.selectNone();
    let inlineRowIdxFromChildArray = parentNode.children.findIndex( obj => obj.uid === eventData.rows[0].uid );
    if( inlineRowIdxFromChildArray !== -1 ) {
        parentNode.children.splice( inlineRowIdxFromChildArray, 1 );
        parentNode.totalChildCount--;
    }
    //Changing the property of the parentnode after all rows are removed to remove the expand icon
    if( parentNode.children.length === 0 ) {
        parentNode.isLeaf = true;
    }

    if( newUnsavedRows.length === 0 ) {
        Att1InlineAuthoringEditService.notifySaveStateChanged( 'reset' );
        eventBus.publish( 'uniformParamTable.reloadTable' );
    }
    treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
    return {
        unsavedRows: newUnsavedRows,
        failedUnsavedRows: newFailedUnsavedRows
    };
};

/**
 * Removes the unsaved selection plus all the underlaying children from unsavedRows array and view model or just the children
 *
 * @param {object} selectedRow - selected Row
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 * @param {Boolean} removeChildrenOnly - optional, removes the children but not the selected row passed in
 * @returns {Object} - Returns the updated list of unsavedRows
 */
let _removeUnsavedRows = function( selectedRow, unsavedRows, treeDataProvider, removeChildrenOnly ) {
    let toRemoveRows = [];
    let newUnsavedRows = [ ...unsavedRows ];
    if( selectedRow && unsavedRows ) {
        if( !removeChildrenOnly ) {
            //toRemoveRows.push( selectedRow );
            toRemoveRows = selectedRow;
        }
        //get the new UnsavedRows array = old minus the rows to remove
        newUnsavedRows = unsavedRows.filter( function( inlineRow ) {
            return !toRemoveRows.some( function( inlineRowToRemove ) {
                return inlineRowToRemove.uid === inlineRow.viewModelObject.uid;
            } );
        } );

        // remove those rows from the loaded objects as well in the viewModelCollection
        let viewModelCollection = treeDataProvider.getViewModelCollection();
        viewModelCollection.removeLoadedObjects( toRemoveRows );
        treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
        treeDataProvider.setSelectionEnabled( true );
    }
    // LCS-711405 After authoring a new row and deleting it save command not getting disabled
    // Disable inline authoring mode when there are no unsaved rows.
    if( newUnsavedRows.length === 0 ) {
        let contextKey = CONFIG_CONTEXT_KEY;
        let clonedCtx = _.cloneDeep( appCtxService.getCtx( contextKey ) );
        clonedCtx.inlineAuthoringContext.isInlineAuthoringMode = false;
        appCtxService.updatePartialCtx( contextKey + '.inlineAuthoringContext.isInlineAuthoringMode', clonedCtx.inlineAuthoringContext.isInlineAuthoringMode );
    }
    //there may be unsaved rows that are not a fail, new ones getting added and removed, so manage the failed ones separately
    let newUnsavedRowstoFilter = [ ...newUnsavedRows ];
    let newFailedUnsavedRows = newUnsavedRowstoFilter.filter( function( inlineRow ) {
        return inlineRow.partialErrorText !== undefined;
    } );

    return {
        unsavedRows: newUnsavedRows,
        failedUnsavedRows: newFailedUnsavedRows
    };
};

/**
 * Returns the parent element based on availability
 * @param {Object} commandContext - commandContext of the element
 * @param {Object} topTreeNode - topTreeNode of the element
 * @returns {Object} - Returns the parent element
 */
export let populateParentElement = function( commandContext, topTreeNode ) {
    return topTreeNode;
};

/**
 * Removes the inline edit handler
 * @param {String} inlineAuthoringHandlerContext - the name of the inlineAuthoringHandlerContext
 */
export let removeEditHandler = function( inlineAuthoringHandlerContext ) {
    var editHandler = editHandlerSvc.getEditHandler( inlineAuthoringHandlerContext );
    if( editHandler ) {
        editHandlerSvc.removeEditHandler( inlineAuthoringHandlerContext );
    }
};

/**
 * This function is added to process the Partial error being thrown
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
function processPartialErrors( response ) {
    if( response && response.ServiceData.partialErrors ) {
        var msgObj = {
            msg: '',
            level: 0
        };
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
        if( msgObj.level <= 1 ) {
            messagingService.showInfo( msgObj.msg );
        } else {
            messagingService.showError( msgObj.msg );
        }
        return msgObj.msg;
    }
    return '';
}

/**
 * Gets message string
 * @param {*} messages Messages to display
 * @param {*} msgObj msgObj
 */
var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
 * Removes the unsaved selection plus all the underlaying children from unsavedRows array and view model or just the children
 *
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {Object} treeDataProvider - Tree data provider
 * @returns {Object} - Returns empty unsaved rows array
 */
export let discardAllUnsavedRows = function( unsavedRows, treeDataProvider ) {
    let loadedViewModelObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let parentVMO = treeDataProvider.topTreeNode;
    _.forEach( unsavedRows, function( inlineRow ) {
        let existingInlineRowIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.viewModelObject.uid );
        if( existingInlineRowIdx !== -1 ) {
            loadedViewModelObjects.splice( existingInlineRowIdx, 1 );
        }
        let inlineRowIdxFromChildArray = parentVMO.children.findIndex( obj => obj.uid === inlineRow.viewModelObject.uid );
        if( inlineRowIdxFromChildArray !== -1 ) {
            parentVMO.children.splice( inlineRowIdxFromChildArray, 1 );
        }
    } );

    let viewModelCollection = treeDataProvider.getViewModelCollection();
    treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );

    treeDataProvider.setSelectionEnabled( true );
    treeDataProvider.selectionModel.setSelection( [] );
    //Att1InlineAuthoringEditService.notifySaveStateChanged( 'reset' );
    appCtxService.updatePartialCtx( CONFIG_CONTEXT_KEY + '.inlineAuthoringContext.isInlineAuthoringMode', false );
    return [];
};

/* TODO - data.unsaved rows is used to collect new rows, that may not work with reusable param tabls. This is alternate method to get new rows from view model.
let getUnSavedRows = function( treeDataProvider ) {
    let unsavedRows = [];
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    _.forEach( vmos, function( vmo ) {
        if ( vmo.isInlineRow ) {
            unsavedRows.push( vmo );
        }
    } );
    return unsavedRows;
}; */

/**
 * Checks if allowed to save, any empty required field triggers a false
 *
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {object} treeDataProvider - Tree data provider
 * @returns {Boolean} - Returns true if allowed to save false otherwise
 */
export let isAllowedToSave = function( unsavedRows, treeDataProvider ) {
    let ret = true;
    let newUnsavedRows = [ ...unsavedRows ];
    _.forEach( newUnsavedRows, function( inlineRow ) {
        if( ret ) {
            let inlineRowVmo = _getInlineRowByUid( treeDataProvider, inlineRow.viewModelObject.uid );
            _.forEach( inlineRowVmo.props, function( prop ) {
                if( ret && prop.isEditable && prop.isRequired && ( prop.dbValue === undefined || prop.dbValue === null || prop.dbValue === '' ) ) {
                    prop.isNotAllowedToSave = true;
                    ret = false;
                }
            } );
        }
    } );
    return ret;
};

/**
 * Get the property names from the column configuration.
 * @param {Object} columnConfig Column config columns
 * @returns {Object} Column name array
 */
export const getColumnNames = ( columnConfig ) => {
    var columnNames = [ uomProp, typeProp, 'att1AttrInOut' ];
    for ( var i = 0; i < columnConfig.columns.length; i++ ) {
        if ( columnConfig.columns[i].hiddenFlag === false ) {
            columnNames.push( columnConfig.columns[i].propertyName );
        }
    }
    columnNames = _.uniq( columnNames );
    return columnNames;
};

/**
 *
 * @param {Object} currColumnConfig Current columns
 * @param {Boolean} hiddenFlagValue If false, add inline create column changes. True to remove.
 * @param {Boolean} createParamWithDef True when parameter definitions are used
 * @param {String} objectColumnName Heading for the object_string Column
 * @returns {Object} Updated column config
 */
export const changeParameterColumnConfig = ( currColumnConfig, hiddenFlagValue, createParamWithDef, objectColumnName, cols ) => {
    let newColumnConfigCols = [ ...currColumnConfig.columns ];
    let newCols = [ ...cols ];
    if( ( hiddenFlagValue === undefined || hiddenFlagValue === false )
        &&  newColumnConfigCols[0].propertyName !== objectProp ) {
        var objectNameColumn = {
            associatedTypeName: 'Att1AttributeAlignmentProxy',
            columnOrder: 100,
            displayName: objectColumnName,
            hiddenFlag: false,
            pixelWidth: 200,
            propertyName: objectProp,
            sortDirection: 'Ascending',
            sortPriority: 1,
            typeName: 'Att1AttributeAlignmentProxy',
            isTreeNavigation: true
        };
        newColumnConfigCols.splice( 0, 0, objectNameColumn );
    }else if( hiddenFlagValue === true && newColumnConfigCols[0].propertyName === objectProp ) {
        newColumnConfigCols.splice( 0, 1 );
    }
    let moveColumn = 0;
    for ( var i = 0; i < newColumnConfigCols.length; i++ ) {
        if( newColumnConfigCols[i].propertyName === nameProp ) {
            if( hiddenFlagValue === undefined || hiddenFlagValue === false ) {
                newColumnConfigCols[i].isTreeNavigation = false;
            } else if( hiddenFlagValue === true ) {
                newColumnConfigCols[i].isTreeNavigation = true;
            }
        } else if( newColumnConfigCols[i].propertyName === typeProp && createParamWithDef !== 'true'
            || newColumnConfigCols[i].propertyName === paramDefProp && createParamWithDef === 'true' ) {
            if ( hiddenFlagValue !== true && newColumnConfigCols[i].hiddenFlag ) {
                moveColumn = i;
            }
            newColumnConfigCols[i].hiddenFlag = hiddenFlagValue === true;
        } else if( newColumnConfigCols[i].propertyName === uomProp && createParamWithDef !== 'true' ) {
            newColumnConfigCols[i].hiddenFlag = hiddenFlagValue === true;
        }
        //make the drag and drop false for columns in quick add mode
        newColumnConfigCols[i].enableColumnMoving = hiddenFlagValue === true;
    }
    //make the drag and drop false for columns in quick add mode
    _.forEach( newCols, function( newCol ) {
        newCol.enableColumnMoving = hiddenFlagValue === true;
    } );

    // if a required property column has been added, insert it after the name column
    if ( moveColumn > 0 ) {
        let column = newColumnConfigCols[ moveColumn ];
        newColumnConfigCols.splice( moveColumn, 1 );
        newColumnConfigCols.splice( 2, 0, column );
    }
    return {
        newColumnConfigCols: newColumnConfigCols,
        columnConfigId: currColumnConfig.columnConfigId,
        columnNames: getColumnNames( currColumnConfig ),
        newCols: newCols
    };
};

/**
 * Returns the new row cache after a server call filled with the necessary info
 * to create further rows of the same type from cache
 * @param {Object} response - the response from server
 * @param {Object} response2 - the response from server
 * @param {object} newRowCacheMap - cached rows
 * @returns {Object} - Returns new row cache
 */
export const processInlineTemplates = ( response, response2, newRowCacheMap ) => {
    let templates = { ...newRowCacheMap };
    let dataType = response.outputs[0].clientId;
    let template = parsingUtils.parseJsonString( response.outputs[0].viewModelObject );
    if ( template !== '' ) {
        templates[ dataType ] = template;
    }
    return templates;
};

/**
 * Start Quick Add edit mode
 * @param {*} inlineAuthoringHandlerContext Edit context
 */
export const editInlineRow = ( inlineAuthoringHandlerContext ) => {
    let callBackObj = {
        inlineAuthoringEditHandler: inlineAuthoringHandlerContext,
        cancelEdits: function() {
            return cancelEdits();
        },
        saveEdits: function() {
            return saveEdits();
        }
    };
    Att1InlineAuthoringEditService.startEdit( callBackObj );
};

export const getOptionMap = ( subPanelCtx ) => {
    let optionMap = [];
    optionMap.defaultUsage = 'input';
    return optionMap;
};
export default exports = {
    changeParameterColumnConfig,
    updateGMMForSelectedDataType,
    checkForDataTypeTemplate,
    populateVisiblePropertyList,
    renderInlineRow,
    resetInlineDataCache,
    updateInlineRowVMOProperties,
    cancelEdits,
    saveEdits,
    postSaveHandler,
    removeUnsavedRows,
    removeInlineRowsAfterSave,
    updateUnsavedRows,
    populateParentElement,
    removeEditHandler,
    discardAllUnsavedRows,
    isAllowedToSave,
    processPartialErrors,
    processInlineTemplates,
    checkForParameterDefTemplate,
    getOptionMap,
    editInlineRow
};
