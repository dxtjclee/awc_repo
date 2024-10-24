// Copyright (c) 2023 Siemens

/**
 * Service to provide utilities to load Tools
 *
 * @module js/ssp0ToolService
 */
import AwLovEdit from 'viewmodel/AwLovEditViewModel';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import eventBus from 'js/eventBus';
import iconService from 'js/iconService';
import localeService from 'js/localeService';
import msgSvc from 'js/messagingService';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';
import uwPropertySvc from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import soaService from 'soa/kernel/soaService';
import messagingService from 'js/messagingService';
import ssp0ColumnArrangeService from 'js/ssp0ColumnArrangeService';

let exports = {};
const RESOURCE_MESSAGE = 'ssp0Messages';

/**
 * Set the tree node properties
 * @param {Object} response response of SOA
 * @param {Object} data data
 * @return {Object} TreeLoadResult of node
 */
export let setTreeProperties = function( response, data ) {
    let objectsToReturn = [];
    if( response.modelObjects !== undefined ) {
        const modelObjects = response.modelObjects || response.data.modelObjects;
        Object.values( modelObjects ).filter( modelObject => modelObject.props && modelObject.props.bl_line_name &&
            modelObject.props.bl_occ_type && modelObject.props.bl_item_object_type && modelObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_EQUIPMENT_PROCESS ) ).forEach(
            modelObject => {
                let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( modelObject, 'create', undefined, undefined, true );
                if( vmo.props.bl_occ_type ) {
                    let vmProp = uwPropertySvc.createViewModelProperty( 'bl_occ_type', 'Occurrence Type', 'STRING',
                        vmo.props.bl_occ_type.dbValues[ 0 ], [ vmo.props.bl_occ_type.dbValues[ 0 ] ] );
                    uwPropertySvc.setIsEditable( vmProp, false );
                    uwPropertySvc.setEditState( vmProp, false );
                    uwPropertySvc.setHasLov( vmProp, true );
                    uwPropertySvc.setIsRequired( vmProp, true );
                    vmo.props.bl_occ_type = vmProp;
                }
                if( vmo.props.bl_item_object_desc ) {
                    vmo.props.bl_item_object_desc.isPropertyModifiable = false;
                    vmo.props.bl_item_object_desc.isEditable = false;
                }
                vmo.propertyDescriptor = {
                    displayName: vmo.propertyDisplayName
                };
                vmo.getViewModel = function() {
                    return data;
                };
                vmo.displayName = modelObject.props.bl_line_name.dbValues[ 0 ];
                let parentObject = Object.values( modelObjects ).filter( modelObject => modelObject.uid === vmo.props.bl_rev_fnd0objectId.dbValues[ 0 ] );
                vmo.typeIconURL = _getIconURL( parentObject[ 0 ] );
                vmo.isVisible = false;
                vmo.isLeaf = true;
                objectsToReturn.push( vmo );
            } );
    }
    return {
        response: objectsToReturn,
        totalFound: objectsToReturn.length
    };
};

let _getIconURL = function( parentObject ) {
    if( parentObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_EQUIPMENT_REVISION ) ) {
        return iconService.getTypeIconURL( servicePlannerConstants.TYPE_RESOURCE_PROCESS );
    }
    return iconService.getTypeIconURL( servicePlannerConstants.TYPE_ITEM_REVISION );
};
/**
 * Get child nodes of the tree
 * @param {Object} response response of SOA
 * @param {Object} data data of ViewModel
 * @return {Array.Object} Array of modelObjects
 */
export const getChildNodes = function( response, data ) {
    const selectedVMO = response.plain[ 0 ];
    let modelObjects = undefined;
    if( response.modelObjects ) {
        modelObjects = response.modelObjects;
    } else if( response.ServiceData && response.ServiceData.modelObjects ) {
        modelObjects = response.ServiceData.modelObjects;
    }
    let found = false;
    let input = [];
    data.childExist = false;

    if( modelObjects && modelObjects[ selectedVMO ].uid && modelObjects[ selectedVMO ].props.bl_child_lines && modelObjects[ selectedVMO ].props.bl_child_lines.dbValues.length > 0 ) {
        found = true;
        data.childExist = true;
        const objects = modelObjects[ selectedVMO ].props.bl_child_lines.dbValues;
        input = _getMfg0BvrToolsObjects( objects );
        return input;
    }

    if( !found ) {
        data.treeLoadResult = { response: [], totalFound: 0 };
    }
    return input;
};

/**
 * Get tool nodes of the tree
 * @param {Object} response response of SOA
 * @param {Object} data data of ViewModel
 * @return {Array.Object} Array of modelObjects
 */
export const getToolNodes = function( response, data ) {
    if( response && response.plain ) {
        const selectedVMO = response.plain[ 0 ];
        let modelObjects = undefined;
        if( response.modelObjects ) {
            modelObjects = response.modelObjects;
        } else if( response.ServiceData && response.ServiceData.modelObjects ) {
            modelObjects = response.ServiceData.modelObjects;
        }
        let found = false;
        let input = [];
        data.childExist = false;
        if( modelObjects && modelObjects[ selectedVMO ].uid && modelObjects[ selectedVMO ].props.Mfg0used_equipment && modelObjects[ selectedVMO ].props.Mfg0used_equipment.dbValues.length > 0 ) {
            found = true;
            data.childExist = true;
            const objects = modelObjects[ selectedVMO ].props.Mfg0used_equipment.dbValues;
            input = _getMfg0BvrToolsObjects( objects );
            return input;
        }

        if( !found ) {
            data.treeLoadResult = { response: [], totalFound: 0 };
        }
        return input;
    }
};

let _getMfg0BvrToolsObjects = function( objects ) {
    let input = [];
    objects.forEach( o => input.push( {
        uid: o
    } ) );
    return input;
};

/**
 * Reload the Tools Tree
 * @param {Object} dataProvider dataProvider of Tools tree
 * @param {String} selection boolean value
 */
export let reloadToolsTree = function( dataProvider, selection ) {
    if( dataProvider ) {
        dataProvider.columnConfigLoadingInProgress = false;
        eventBus.publish( 'toolsTree.plTable.reload' );
    }
    if( selection ) {
        const subscribeTablePageLoaded = eventBus.subscribe( 'toolsTree.plTable.loadMorePages', function( eventData ) {
            eventBus.publish( 'Ssp0ToolsTree.selectVMOinTree' );
            eventBus.unsubscribe( subscribeTablePageLoaded );
        } );
    }
};

/**
 * Edit the table
 */
export let startEdit = function() {
    //Start editing the table
};

/**
 * Validate selection for group or role LOV and if it is valid, use the selection to filter user data
 *
 * @param {Object} selected selected object if any, else null.
 * @param {String} suggestion Filter string value if filter string does not match any object.
 * @returns {Object} The object contains selection validity result.
 */
export let validateSelection = function( selected, suggestion ) {
    let valid = true;
    if( selected.length > 0 && selected[ 0 ].propInternalValue === '' ) {
        valid = false;
        let localTextBundle = localeService.getLoadedText( RESOURCE_MESSAGE );
        msgSvc.showError( localTextBundle.occTypeEmptyError );
    } else {
        valid = suggestion.some( occType => occType.propInternalValue !== selected[ 0 ].propInternalValue );
    }
    return {
        valid: valid
    };
};

/**
 * Get Occurrence Type List
 * @param {Object} response response of SOA
 * @return {Array} array of occurrence Type List
 */
export let getOccTypeList = function( response ) {
    let occTypeList = [];
    const responseArray = response.response;
    for( let key in responseArray ) {
        const values = responseArray[ key ].values.values;
        Object.values( values ).filter( value => !occTypeList.some( occType => occType.propDisplayValue === value ) ).forEach( value => {
            occTypeList.push( {
                propDisplayValue: value,
                propInternalValue: value,
                propDisplayDescription: '',
                hasChildren: false,
                children: {},
                sel: false

            } );
        } );
    }
    return occTypeList;
};

/**
 * Get Preferences Names List
 * @param {Object} response response of SOA
 * @return {Array} array of occurrence Type List
 */
export let getPreferencesNamesList = function( response ) {
    let validPreferencesList = new Set();
    const values = response.response[ 0 ].values.values;
    Object.values( values ).filter( value => value.includes( ':Mfg0MEResource:MERelationTypeUsedEquipment' ) ).forEach( value => {
        let splitArray = value.split( ':' );
        if( splitArray[ 2 ] ) {
            splitArray[ 2 ].split( ',' ).forEach( item => validPreferencesList.add( item ) );
        }
    } );
    let preferencesList = Array.from( validPreferencesList );
    appCtxSvc.registerCtx( 'preferencesList', preferencesList );

    return Array.from( validPreferencesList );
};

/**
 * render function for AwLovEdit
 * @param { * } props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awCustomLOVComponentRenderFunction = ( props ) => {
    const { viewModel, ...prop } = props;

    let fielddata = { ...prop.fielddata };
    fielddata.hasLov = true;
    fielddata.dataProvider = viewModel.dataProviders.occTypesProvider;

    const passedProps = { ...prop, fielddata };

    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

/**
 * Get Row column for tree table
 * @param {Object} data data
 * @return {Promise} deferred promise
 */
export let loadToolsTreeTableColumns = async function( data, resetFlag ) {
    const localizeDisplayName = data.grids.toolsTree.i18n;
    let deferred = AwPromiseService.instance.defer();
    let awColumnInfos = [];
    let serverColumns = [];
    const firstColumnConfigCol = {
        name: 'bl_line_name',
        displayName: localizeDisplayName.nameValueColumn,
        width: 285,
        enableColumnMenu: false,
        enableColumnMoving: false,
        pinnedLeft: true,
        columnOrder: 1,
        isTreeNavigation: true,
        propertyName: 'bl_line_name',
        pixelWidth: 200,
        hiddenFlag: false
    };
    const secondColumnConfigCol = {
        name: 'bl_occ_type',
        displayName: localizeDisplayName.occTypeValueColumn,
        minWidth: 200,
        width: 200,
        enableColumnMenu: false,
        enableColumnMoving: false,
        columnOrder: 2,
        renderingHint: 'OccurrenceTypeProvider',
        pinnedLeft: false,
        propertyName: 'bl_occ_type',
        pixelWidth: 200,
        hiddenFlag: false
    };
    awColumnInfos.push( firstColumnConfigCol );
    awColumnInfos.push( secondColumnConfigCol );
    var input = {
        getOrResetUiConfigsIn: [ {
            scope: 'LoginUser',
            scopeName: '',
            clientName: 'AWClient',
            resetColumnConfig: resetFlag,
            columnConfigQueryInfos: [ {
                clientScopeURI: 'Ssp0ToolsTableManagement',
                operationType: 'union',
                typeNames: [],
                columnsToExclude: []
            } ],
            businessObjects: [
                {}
            ]
        } ]
    };
    await soaService.post( 'Internal-AWS2-2023-06-UiConfig', 'getOrResetUIColumnConfigs4', input ).then( function( response ) {
        serverColumns = response.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns;
    } );
    if( serverColumns.length > 0 ) {
        serverColumns.forEach( column => {
            awColumnInfos.push( column );
        } );
    }
    ssp0ColumnArrangeService.saveColumnConfigToCtx( serverColumns, 'ToolsTableProperties' );
    awColumnInfos = _.sortBy( awColumnInfos, function( column ) { return column.columnOrder; } );

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos,
            columnConfigId: 'Ssp0ToolsTableManagement',
            objectSetUri: 'Ssp0ToolsTableManagement'
        }
    } );

    return deferred.promise;
};

/**
 * Refresh the Tools Tree
 */
export let refreshToolsTree = function() {
    if( appCtxSvc.ctx.is3DTabPresent ) {
        eventBus.publish( 'toolsTree.plTable.clientRefresh' );
    }
};

/**
 * This function disconnects consumed selected tool/tools from WC/SR
 *
 * @param {Array} sourceObjects - selected tools element
 * @param {Object} target - WC/SR
 */
export let unAssignPart = function( sourceObjects, target ) {
    let input = [];
    for( let sourceObject of sourceObjects ) {
        input.push( {
            disconnectFrom: {
                uid: target.uid,
                type: target.type
            },
            clientId: '',
            relationName: '',
            object: {
                uid: sourceObject.uid,
                type: sourceObject.type
            }
        } );
    }
    soaService.postUnchecked( 'Manufacturing-2009-10-DataManagement', 'disconnectObjects', {
        input: input
    } )
        .then( function( response ) {
            if( response.partialErrors && response.partialErrors.length > 0 ) {
                showError( response.partialErrors );
            } else {
                eventBus.publish( 'Ssp0Tools.triggerFunction', { selectedObj: appCtxSvc.getCtx( 'selectedVMO' ) } );
            }
        } );
};
/**
 *
 * @param {Array} partialErrors - partial errors array
 */
function showError( partialErrors ) {
    for( let i = 0; i < partialErrors.length; i++ ) {
        messagingService.showError( partialErrors[ i ].errorValues[ 0 ].message );
    }
}
export let loadToolsTree = function() {
    eventBus.publish( 'Ssp0Tools.triggerFunction', { selectedObj: appCtxSvc.getCtx( 'selectedVMO' ) } );
};

/**
 * Select VMO the Tools Tree
 * @param {Object} dataProvider dataProvider
 */
export let selectVMOinTree = function( dataProvider ) {
    if( dataProvider ) {
        const objectToSelect = dataProvider.viewModelCollection.loadedVMObjects[ dataProvider.viewModelCollection.totalFound - 1 ];
        dataProvider.selectionModel.setSelection( objectToSelect );
    }
};
/**

* get Child node attributes

* @return {Array} array of properties to load

*/

let getChildNodeAttributes = function() {
    let attributes = [
        'bl_has_children',
        'bl_line_name',
        'bl_occ_type',
        'bl_item_object_desc',
        'bl_item_object_type',
        'bl_rev_fnd0objectId'
    ];
    let columnsFromServer = appCtxSvc.getCtx( 'ToolsTableProperties' );
    if( columnsFromServer !== undefined ) { return attributes.concat( columnsFromServer ); }
    return attributes;
};
export default exports = {
    selectVMOinTree,
    loadToolsTree,
    unAssignPart,
    refreshToolsTree,
    getToolNodes,
    awCustomLOVComponentRenderFunction,
    getPreferencesNamesList,
    getOccTypeList,
    validateSelection,
    loadToolsTreeTableColumns,
    startEdit,
    getChildNodes,
    setTreeProperties,
    reloadToolsTree,
    getChildNodeAttributes
};
