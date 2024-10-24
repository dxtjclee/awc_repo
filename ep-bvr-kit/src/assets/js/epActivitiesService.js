// Copyright (c) 2022 Siemens

import appCtxService from 'js/appCtxService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import cdm from 'soa/kernel/clientDataModel';
import awColumnSvc from 'js/awColumnService';
import tcPropConstants from 'js/constants/tcPropertyConstants';
import viewModelObjectSvc from 'js/viewModelObjectService';
import preferenceService from 'soa/preferenceService';
import cmm from 'soa/kernel/clientMetaModel';
import mfeFilterAndSortSvc from 'js/mfeFilterAndSortService';
import epSaveService from 'js/epSaveService';
import saveInputWriterService from 'js/saveInputWriterService';
import AwPromiseService from 'js/awPromiseService';
import { constants as epActivitiesConstants } from 'js/constants/epActivitiesConstants';
import epTimeUnitsService from 'js/epTimeUnitsService';
import localeService from 'js/localeService';
import app from 'app';
import epTabsService from 'js/epTabsService';
import soaService from 'soa/kernel/soaService';
import mfeTableService from 'js/mfeTableService';
import _ from 'lodash';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import { constants as epSaveConstants } from 'js/epSaveConstants';

/**
 * EP Activities service
 *
 * @module js/epActivitiesService
 */

const ActivitiesType = {
    PartActivities: 'part',
    TimeActivities: 'time'
};

const SHOW_ACTIVITIES_TABLE_TOGGLE = 'epPageContext.showActivities';
const GET_ACTIVITIES_LOAD_TYPE = 'GetActivities';
const APPEND_PROP = '_';

let activitiesToAssociatedOperationMap = {};
let listOfActivityObjects = [];
let listOfOperationObjects = [];
const propertiesForNumericSort = [
    epActivitiesConstants.AL_ACTIVITY_WORK_TIME_PROP_NAME,
    epActivitiesConstants.AL_ACTIVITY_TIME_SYSTEM_UNIT_TIME_PROP_NAME,
    epActivitiesConstants.AL_ACTIVITY_TIME_SYSTEM_FREQUENCY_PROP_NAME,
    epActivitiesConstants.AL_ACTIVITY_MFG_QUANTITY_PROP_NAME
];
const READ_ONLY_PROCESS_PROPERTIES = [ epActivitiesConstants.MBC_ACT_WORK_TIME_CONVERTED ];
const READ_ONLY_OPERATION_PROPERTIES = [
    epActivitiesConstants.AL_ACTIVITY_TIME_SYSTEM_UNIT_TIME_PROP_NAME,
    epActivitiesConstants.AL_ACTIVITY_WORK_TIME_PROP_NAME
];
const READ_ONLY_OPERATION_PROPERTIES_BT_TYPE = {
    [ epActivitiesConstants.MBC_ACT_UNIT_TIME_CONVERTED ]: epActivitiesConstants.EPT_INSTANCE_ACTIVITY_LINE,
    [ epActivitiesConstants.AL_ACTIVITY_TIME_SYSTEM_CODE_PROP_NAME ]: epActivitiesConstants.EPT_INSTANCE_ACTIVITY_LINE
};
const NUMERIC_FILTER = 'numericFilter';
const PREFERENCES_PREFIX = 'preferences.';
const ME_DECIMAL_PLACES_PREF = `${PREFERENCES_PREFIX}METimeDecimalPlaces`;
let inputObjectUid = null; // The object to get its activities

const TIME_PROPERTIES_TO_CONVERT = [ 'al_activity_time_system_unit_time', 'al_activity_work_time' ];

const UNITS = {
    '0.001 m': { multiplierToSec: 0.06 },
    '0.01 m': { multiplierToSec: 0.6 },
    '0.1 m': { multiplierToSec: 6 },
    d: { multiplierToSec: 86400 },
    FAC: { multiplierToSec: 0.18 },
    h: { multiplierToSec: 3600 },
    min: { multiplierToSec: 60 },
    MOD: { multiplierToSec: 0.129 },
    sec: { multiplierToSec: 1 },
    TMU: { multiplierToSec: 0.036 }
};

/**
 *
 * @param {String} contextProcess context process for loading activities
 * @param {object} sortCriteria - the sort criteria object
 * @param {object} columnFilters - the column filters object
 * @param {object} orderByPredecessor - order activities by predecessor
 * @return {promise} a promise object
 */
export function loadActivities( contextProcess, sortCriteria, columnFilters, orderByPredecessor ) {
    if( contextProcess ) {
        return getActivities( contextProcess, orderByPredecessor ).then(
            ( listOfActivities ) => filterAndSortActivities( listOfActivities, sortCriteria, columnFilters )
        );
    }
    //else - nothing is selected, so clean up
    inputObjectUid = null;
    listOfActivityObjects = [];
    listOfOperationObjects = [];
    return AwPromiseService.instance.resolve( null );
}

/**
 *
 * @param {String} contextProcess context process for loading activities
 * @param {object} orderByPredecessor - order activities by predecessor
 * @param {object} isAfterFirstAddActivity - if true, get activities from server anyway, to initialize the operation.
 * @returns {Array} list of activities
 */
function getActivities( contextProcess, orderByPredecessor, isAfterFirstAddActivity ) {
    if( !isAfterFirstAddActivity && listOfActivityObjects.length > 0 && inputObjectUid === contextProcess.uid ) {
        return AwPromiseService.instance.resolve( [ ...listOfActivityObjects ] );
    }
    inputObjectUid = contextProcess.uid;
    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( GET_ACTIVITIES_LOAD_TYPE, inputObjectUid );
    return epLoadService.loadObject( loadTypeInputs, false ).then( function( result ) {
        listOfActivityObjects = [];
        listOfOperationObjects = [];
        let listOfActivities = [];

        result.relatedObjectsMap && result.relatedObjectsMap.sequence && Object.keys( result.relatedObjectsMap.sequence ).length > 0 &&
            Object.keys( result.relatedObjectsMap.sequence.additionalPropertiesMap2 ).length > 0 && result.relatedObjectsMap.sequence.additionalPropertiesMap2.operations.forEach( operationUid => {
            const objType = cdm.getObject( operationUid );
            listOfOperationObjects.push( {
                type: objType.type,
                uid: objType.uid
            } );

            let activityObjects = result.relatedObjectsMap[ operationUid ].additionalPropertiesMap2.activities.map( activityUid => {
                activitiesToAssociatedOperationMap[ activityUid ] = operationUid;
                return cdm.getObject( activityUid );
            } );
            listOfActivities.push( ...activityObjects );
        } );

        if( orderByPredecessor ) {
            listOfActivities = sortListOfActivitiesByPredecessor( listOfActivities );
        }
        return listOfActivities;
    } );
}

/**
 * @param {ModelObject[]} listOfActivities - a given set of modelObjects
 * @param {object[]} sortCriteria - the sort criteria object array
 * @param {object[]} columnFilters - the filters object array
 * @return {modelObject[]} a filtered array of modelObjects
 */
function filterAndSortActivities( listOfActivities, sortCriteria, columnFilters ) {
    let filteredList = listOfActivities;
    if( columnFilters && columnFilters.length > 0 ) {
        columnFilters.forEach( ( filter ) => {
            if( propertiesForNumericSort.includes( filter.columnName ) ) {
                filteredList = mfeFilterAndSortSvc.numericFiltersManager( filter, filteredList );
            } else {
                filteredList = mfeFilterAndSortSvc.filterModelObjects( filteredList, columnFilters );
            }
        } );
    }
    if( sortCriteria && sortCriteria[ 0 ] ) {
        const { fieldName } = sortCriteria[ 0 ];
        if( propertiesForNumericSort.includes( fieldName ) ) {
            return mfeFilterAndSortSvc.sortModelObjectsBasedOnStringNumericValue( filteredList, sortCriteria );
        }
    }
    return mfeFilterAndSortSvc.sortModelObjects( filteredList, sortCriteria );
}

/**
 * Creating columns for table displaying information for two model objects
 *
 * @param {String} vmoObjectType primary object type
 * @param {String} secondaryObjectType secondary object type
 * @param {String} preferenceName - the preference name which contains the list of object properties to display as a column in the table
 * @param {Object} dataProvider - the table data provider
 * @param {object} columnProvider - the table column provider
 * @param {Object} additionalPolicyObjects - additional objects to add to policy
 *
 * @return {promise<null>} returns a promise which is resolved once we finished to create the columns
 */
export function createColumnsWithTwoObjects( vmoObjectType, secondaryObjectType, preferenceName, dataProvider, columnProvider = {}, additionalPolicyObjects = {} ) {
    const {
        enableFiltering = false, enableColumnResizing = true, enablePinning = false,
        enableSorting = false, enableCellEdit = false, columnDefaultWidth = 100, enableColumnHiding = false, enableColumnMoving = true
    } = columnProvider;

    const propPolicy = {};
    propPolicy.types = additionalPolicyObjects && additionalPolicyObjects.types ? additionalPolicyObjects.types : [];

    let tableColumns = [];

    return preferenceService.getStringValues( preferenceName ).then( ( preferenceValues ) => {
        if( Array.isArray( preferenceValues ) && preferenceValues.length > 0 ) {
            preferenceValues.forEach( ( column ) => {
                let displayName = '';
                let [ objType, objPropertyName, columnWidth ] = column.split( '.' );
                if( !objType || !objPropertyName ) {
                    return;
                }
                propPolicy.types.push( {
                    name: objType,
                    properties: [ { name: objPropertyName } ]
                } );
                let modifiable;
                //Adding columns for properties for secondary object
                if( cmm.isInstanceOf( objType, cmm.getType( secondaryObjectType ) ) ) {
                    const type = cmm.getType( objType );
                    if( type && type.propertyDescriptorsMap[ objPropertyName ] ) {
                        displayName = type.propertyDescriptorsMap[ objPropertyName ].displayName;
                    }
                    objPropertyName = objType + APPEND_PROP + objPropertyName;
                    modifiable = false;
                }

                const ObjNameColWidth = objPropertyName === tcPropConstants.OBJECT_STRING ? 200 : columnDefaultWidth;
                columnWidth = isNaN( columnWidth ) || columnWidth === '' ? ObjNameColWidth : parseInt( columnWidth );

                tableColumns.push( awColumnSvc.createColumnInfo( {
                    name: objPropertyName,
                    propertyName: objPropertyName,
                    displayName: displayName !== '' ? displayName : null,
                    typeName: vmoObjectType,
                    minWidth: 25,
                    width: columnWidth,
                    enableFiltering,
                    enableColumnResizing,
                    enablePinning,
                    enableColumnHiding,
                    enableSorting,
                    enableCellEdit,
                    enableColumnMoving,
                    modifiable
                } ) );
            } );

            tableColumns.forEach( column => {
                if( propertiesForNumericSort.includes( column.propertyName ) ) {
                    column.filterDefinition = NUMERIC_FILTER;
                }
                if( READ_ONLY_PROCESS_PROPERTIES.includes( column.propertyName ) ) {
                    column.modifiable = false;
                }
            } );

            dataProvider.columnConfig = {
                columns: tableColumns
            };
            dataProvider.policy = propPolicy;
        }
    } );
}

/**
 * @param {String} secondaryObjectType secondary object type
 * @param {Array} activitiesVmos list of activity view model objects
 * @param {Array} preferenceName column configuration preference name for activities table
 */
export function updatePropertiesForOperationInVmo( secondaryObjectType, activitiesVmos, preferenceName, sortCriteria, columnFilters ) {
    const preferenceValues = appCtxService.getCtx( PREFERENCES_PREFIX + preferenceName );
    activitiesVmos.forEach( ( vmo ) => {
        let operationObject = cdm.getObject( activitiesToAssociatedOperationMap[ vmo.uid ] );
        preferenceValues.forEach( ( column ) => {
            let [ objType, objPropertyName ] = column.split( '.' );
            if( cmm.isInstanceOf( objType, cmm.getType( secondaryObjectType ) ) && operationObject && operationObject.props[ objPropertyName ] ) {
                let isArray = operationObject.props[ objPropertyName ].propertyDescriptor.anArray ?
                    operationObject.props[ objPropertyName ].propertyDescriptor.anArray : false;
                const operationProperty = {
                    isArray: isArray,
                    value: operationObject.props[ objPropertyName ].dbValues,
                    displayValue: operationObject.props[ objPropertyName ].uiValues,
                    propType: viewModelObjectSvc.getClientPropertyType( operationObject.props[ objPropertyName ].propertyDescriptor.valueType, isArray ),
                    displayName: operationObject.props[ objPropertyName ].propertyDescriptor.displayName
                };
                const secondaryPropName = objType + APPEND_PROP + objPropertyName;
                vmo.props[ secondaryPropName ] = viewModelObjectSvc.constructViewModelProperty( operationProperty, objType + APPEND_PROP + objPropertyName, vmo );
                setPropertyAsReadOnly( vmo, secondaryPropName );

                //Adding property descriptors for secondary object properties to enable sort/filter.
                if( vmo.propertyDescriptors[ secondaryPropName ] ) {
                    vmo.propertyDescriptors[ secondaryPropName ] = operationObject.props[ objPropertyName ].propertyDescriptor;
                }
                vmo.props[ secondaryPropName ].propertyDescriptor = operationObject.props[ objPropertyName ].propertyDescriptor;
                setPropertyAsReadOnly( vmo, secondaryPropName );
            } else {
                if( READ_ONLY_OPERATION_PROPERTIES.includes( objPropertyName ) ) {
                    setPropertyAsReadOnly( vmo, objPropertyName );
                }
                if( READ_ONLY_OPERATION_PROPERTIES_BT_TYPE[ objPropertyName ] &&
                    vmo.modelType.typeHierarchyArray.indexOf( READ_ONLY_OPERATION_PROPERTIES_BT_TYPE[ objPropertyName ] ) > -1 ) {
                    setPropertyAsReadOnly( vmo, objPropertyName );
                }
            }
        } );
    } );
    if( listOfActivityObjects.length === 0 ) {
        listOfActivityObjects = activitiesVmos;
    }
}

/**
 * setPropertyAsReadOnly
 * @param {*} vmo the view model onject
 * @param {*} propName the property that should be read only
 */
function setPropertyAsReadOnly( vmo, propName ) {
    vmo.props[ propName ].editable = false;
    vmo.props[ propName ].isPropertyModifiable = false;
}

/**
 *
 * @param {Object} process context process
 * @param {Array} activities list of activities
 */
export function closeAttachmentWindows( process, activities ) {
    listOfActivityObjects = [];
    activitiesToAssociatedOperationMap = {};
    let saveInputWriter = saveInputWriterService.get();
    const contextProcess = {
        id: [ process.uid ]
    };
    const activitiesList = {
        activities: activities.map( activity => activity.uid )
    };
    saveInputWriter.closeAttachmentWindows( contextProcess, activitiesList );
    epSaveService.saveChanges( saveInputWriter, true );
}

/**
 *
 */
export function toggleActivitiesTable( activityType ) {
    let currentActivitiesTableDisplayed = appCtxService.getCtx( SHOW_ACTIVITIES_TABLE_TOGGLE ) ? appCtxService.getCtx( SHOW_ACTIVITIES_TABLE_TOGGLE ) : '';

    // This should be the first if.
    // Thats mean we are toggele again and we should hide the panel therefor set to empty
    if( currentActivitiesTableDisplayed === activityType ) {
        appCtxService.updatePartialCtx( SHOW_ACTIVITIES_TABLE_TOGGLE, '' );
    } else if( activityType === ActivitiesType.PartActivities ) {
        appCtxService.updatePartialCtx( SHOW_ACTIVITIES_TABLE_TOGGLE, ActivitiesType.PartActivities );
    } else if( activityType === ActivitiesType.TimeActivities ) {
        appCtxService.updatePartialCtx( SHOW_ACTIVITIES_TABLE_TOGGLE, ActivitiesType.TimeActivities );
    } else {
        appCtxService.updatePartialCtx( SHOW_ACTIVITIES_TABLE_TOGGLE, '' );
    }
}

/**
 * Calculate the total time duration for Process.
 *
 * @param {object} activitiesModel activities model
 *
 * @returns {string} string with unit for total time duration for Process.
 */
export function calculateProcessDuration( activitiesModel ) {
    let totalDuration = 0.0;
    const allocatedTime = activitiesModel.selectedModelObject.props.Mfg0AllocatedTimeConverted;
    if( allocatedTime && allocatedTime.dbValues[ 0 ] ) {
        totalDuration += parseFloat( allocatedTime.dbValues[ 0 ] );
    } else {
        const activityVMObjects = activitiesModel.activityVMObjects || [];
        activityVMObjects.forEach( ( vmo ) => {
            let activityWorkTime = vmo.props[ epActivitiesConstants.MBC_ACT_WORK_TIME_CONVERTED ];
            if( activityWorkTime && activityWorkTime.dbValues && activityWorkTime.dbValues.length > 0 ) {
                totalDuration += Number( activityWorkTime.uiValues[ 0 ] );
            }
        } );
    }

    const decimalPlacesPrefValue = appCtxService.getCtx( ME_DECIMAL_PLACES_PREF );
    const decimalPlaces = decimalPlacesPrefValue === undefined ? 3 : parseInt( decimalPlacesPrefValue[ 0 ] );
    totalDuration = totalDuration.toFixed( decimalPlaces );

    const unitName = epTimeUnitsService.getCurrentTimeUnitShort();
    return totalDuration.toString() + ' ' + unitName;
}

/**
 * This method sets tile for activities
 * @param {Object} tabData tab data
 * @param {Integer} count count
 */
export function setTabDisplayNameWithQuantity( tabData, count ) {
    const resource = localeService.getLoadedText( app.getBaseUrlPath() + '/i18n/ActivitiesMessages' );
    epTabsService.addCountAndTotalToTabTitle( tabData, count, listOfActivityObjects.length, resource.activityDetailsTitle );
}

/**
 * Save the resized columns width
 *
 * @param {String} secondaryObjectType -
 * @param {String} preferenceName - the preference name which contains the list of object properties to display as a column in the table with each column width
 * @param {Object} columns - the table columns with their width
 *
 * @returns {Promise} promise
 */
export function saveColumnsWidth( secondaryObjectType, preferenceName, columns ) {
    return preferenceService.getStringValues( preferenceName ).then( () => {
        const newPrefValue = [];
        columns.forEach( ( column ) => {
            let objType = column.typeName;
            let objPropertyName = column.propertyName;
            const [ objTypeName, ...propName ] = objPropertyName.split( '_' );
            objPropertyName = propName.join( '_' );
            if( objTypeName === secondaryObjectType ) {
                newPrefValue.push( [ objTypeName, objPropertyName, column.drawnWidth ].join( '.' ) );
            } else {
                newPrefValue.push( [ objType, column.propertyName, column.drawnWidth ].join( '.' ) );
            }
        } );

        return preferenceService.setStringValue( preferenceName, newPrefValue );
    } );
}

/**
 *
 * @param {Array} selectedActivities selected activities
 * @returns {Object} associated operation model object
 */
function getAssociatedOperation( selectedActivities ) {
    const associatedOperationUid = activitiesToAssociatedOperationMap[ selectedActivities[ 0 ].uid ];
    return cdm.getObject( associatedOperationUid );
}

/**
 * temporary client solution to convert time properties according to current time unit
 * @param {Array} activitiesVmos list of activity view model objects
 *  @param {Array} activitiesTableColumnConfiguration column configuration for activities table
 */
function convertTimeUnitsInActivitiyPropertiesInVmos( activitiesVmos, activitiesTableColumnConfiguration ) {
    activitiesVmos.forEach( ( vmo ) => {
        activitiesTableColumnConfiguration.forEach( ( column ) => {
            let [ objType, objPropertyName ] = column.split( '.' );
            if( objType === 'CfgActivityLine' && TIME_PROPERTIES_TO_CONVERT.includes( objPropertyName ) ) {
                let modelObject = cdm.getObject( vmo.uid );
                let value = modelObject.props[ objPropertyName ].dbValues[ 0 ];
                const unitName = epTimeUnitsService.getCurrentTimeUnitShort();
                const multiplierToSec = UNITS[ unitName ].multiplierToSec;
                value /= multiplierToSec;
                const originalVMOProp = vmo.props[ objPropertyName ];
                const originalMOProp = modelObject.props[ objPropertyName ];
                let isArray = originalMOProp.propertyDescriptor.anArray ? originalMOProp.propertyDescriptor.anArray : false;
                const property = {
                    isArray: isArray,
                    value: [ value ],
                    displayValue: [ value.toString() ],
                    propType: viewModelObjectSvc.getClientPropertyType( originalMOProp.propertyDescriptor.valueType, isArray ),
                    displayName: originalMOProp.propertyDescriptor.displayName
                };
                vmo.props[ objPropertyName ] = viewModelObjectSvc.constructViewModelProperty( property, objPropertyName, vmo );
                vmo.props[ objPropertyName ].propertyDescriptor = originalVMOProp.propertyDescriptor;
                vmo.props[ objPropertyName ].editable = originalVMOProp.editable;
                vmo.props[ objPropertyName ].isPropertyModifiable = originalVMOProp.isPropertyModifiable;
            }
        } );
    } );
}

/**
 * updateTimeManagementProperties
 * @returns {Promise} soa service promise
 */
export function updateTimeManagementProperties() {
    if( listOfOperationObjects.length > 0 ) {
        const input = {
            rootNodes: listOfOperationObjects,
            fieldNames: [
                epActivitiesConstants.BL_ME_WORK_TIME_PROP_NAME,
                epActivitiesConstants.BL_ME_DURATION_TIME_PROP_NAME,
                epActivitiesConstants.AL_ACTIVITY_DURATION_TIME_PROP_NAME,
                epActivitiesConstants.AL_ACTIVITY_WORK_TIME_PROP_NAME
            ]
        };

        return soaService.postUnchecked( 'Manufacturing-2010-09-TimeManagement', 'updateTimeManagementProperties', input ).then(
            responseData => responseData.partialErrors ? {} : responseData );
    }
    return AwPromiseService.instance.resolve();
}

/**
 * delete selected activities
 * @param {Array} selectedObjects list of selected activity
 * @param {Object} inputObject panel input
 * @returns {Promise} delete promise
 */
function deleteActivities( selectedObjects, inputObject ) {
    const relatedObjects = [];
    const objectsToRemove = [];
    const saveInputWriter = saveInputWriterService.get();
    const localTextBundle = localeService.getLoadedText( 'ActivitiesMessages' );
    const isMultipleSelected = selectedObjects.length > 1;
    const message = isMultipleSelected ? localTextBundle.deleteActivities : localTextBundle.deleteActivite;
    const messageParameter = isMultipleSelected ? selectedObjects.length : selectedObjects[ 0 ].props.object_string.dbValues[ 0 ];

    relatedObjects.push( inputObject );

    selectedObjects.forEach( selection => {
        const addDeleteObj = {
            id: selection.uid,
            Type: selection.type
        };
        if( inputObject ) {
            addDeleteObj.connectTo = inputObject.uid;
            relatedObjects.push( inputObject );
        }
        objectsToRemove.push( selection.uid );
        saveInputWriter.addDeleteObject( addDeleteObj );
        relatedObjects.push( selection );
    } );

    return mfgNotificationUtils.displayConfirmationMessage( message.format( messageParameter ), localTextBundle.deleteButton, localTextBundle.cancelButton ).then( () => {
        return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( result => {
            if( typeof result === 'string' || typeof result.saveResults === 'string' ) {
                return;
            }
            eventBus.publish( 'ep.activitiesDeleted', { deleted: objectsToRemove } );
        } );
    }, () => {
        logger.info( `User cancelled 'Remove' operation for ${selectedObjects.vmo.props.object_string.dbValue}` );
    } );
}

/**
 * sortListOfActivitiesByPredecessor
 * @param {Array} list  the list to sort
 * @returns {Array} the sorted array
 */
function sortListOfActivitiesByPredecessor( list ) {
    // sort algorithm:

    // 1 define predecessor for each activity if applicable
    _.forEach( list, activity => {
        if( activity.props[ epActivitiesConstants.EPT_PREDECESSORS_PROP_NAME ] ) {
            activity.predecessor = activity.props[ epActivitiesConstants.EPT_PREDECESSORS_PROP_NAME ].dbValues[ 0 ];
        } else {
            activity.predecessor = '';
        }
    } );
    const clonedList = _.clone( list );
    // 2 insert all activities without predecessors to the sorted list
    const sortedList = _.remove( clonedList, element => !element.predecessor );
    // 5 repeat until the cloned list is empty
    //NOTE: _.isEmpty( sortedList ) was added to prevent endless..see card TCM-428349
    // in 2312 it doesn't reproduced
    while( !_.isEmpty( clonedList ) && !_.isEmpty( sortedList ) ) {
        // 3 iterate the activities in the cloned list, push after predecessor if predecessor exists
        _.forEach( clonedList, activity => {
            const index = _.findIndex( sortedList, sortedActivity => activity.predecessor === sortedActivity.uid );
            if( index > -1 ) {
                sortedList.splice( index + 1, 0, activity );
            }
        } );

        // 4 remove the activities we pushed to sorted list from cloned list
        _.pullAll( clonedList, sortedList );
    }
    return sortedList;
}

/**
 *
 * @param {*} createdUid uid of the new activity
 * @param {*} dataProvider table data provider
 * @param {object} orderByPredecessor - order activities by predecessor
 * @param {object} contextProcess -  context process for loading activities
 */
function addCreatedActivity( createdUid, dataProvider, orderByPredecessor, contextProcess ) {
    let sorter;
    if( orderByPredecessor ) {
        sorter = sortListOfActivitiesByPredecessor;
    }

    mfeTableService.addToDataProvider( [ createdUid ], dataProvider, true, sorter );
    listOfActivityObjects.push( cdm.getObject( createdUid ) );
    if( orderByPredecessor ) {
        listOfActivityObjects = sortListOfActivitiesByPredecessor( listOfActivityObjects );
    }
    //in case the initilize didn't happen when there is no activcty
    //we need to call getActivies to load opertaions this is done as part of getActivities.
    //this must be done for the sake of regular activities that the user creates manually (for instantiated activities it used to work).
    if ( listOfActivityObjects.length === 1 ) {
        getActivities( contextProcess, orderByPredecessor, true );
    }
}

/**
 *
 * @param {*} uidsToRemove uid to be removed
 * @param {*} dataProvider table data provider
 */
function removeFromDataProvider( uidsToRemove, dataProvider ) {
    mfeTableService.removeFromDataProvider( uidsToRemove, dataProvider );
    _.remove( listOfActivityObjects, element => uidsToRemove.includes( element.uid ) );
}

/**
 * creats new classic activity
 * @param {*} inputObject panel input operation
 * @returns {Promise} save promise
 */
function createClassicActivity( inputObject ) {
    const newObjectUid = mfeViewModelUtils.generateUniqueId( 'new_object_id' );
    const objectsToCreateEntry = {
        Object: {
            nameToValuesMap: {
                id: [ newObjectUid ],
                connectTo: [ inputObject.uid ],
                Type: [ epBvrConstants.ME_ACTIVITY ]
            }
        },
        ItemProps: {
            nameToValuesMap: {
                object_name: [ 'Activity' ]
            }
        }
    };
    let saveInputWriter = saveInputWriterService.get();
    saveInputWriter.addEntryToSection( epSaveConstants.OBJECTS_TO_CREATE, objectsToCreateEntry );
    return epSaveService.saveChanges( saveInputWriter, true, [ inputObject ] ).then( function( saveResponse ) {
        _.forEach( saveResponse.saveResults, result => {
            if( result.clientID === newObjectUid ) {
                eventBus.publish( 'ep.activityCreated', { created: result.saveResultObject.uid } );
            }
        } );
    } );
}

export default {
    loadActivities,
    createColumnsWithTwoObjects,
    updatePropertiesForOperationInVmo,
    toggleActivitiesTable,
    closeAttachmentWindows,
    saveColumnsWidth,
    calculateProcessDuration,
    setTabDisplayNameWithQuantity,
    convertTimeUnitsInActivitiyPropertiesInVmos,
    getAssociatedOperation,
    updateTimeManagementProperties,
    deleteActivities,
    addCreatedActivity,
    sortListOfActivitiesByPredecessor,
    removeFromDataProvider,
    createClassicActivity,
    TIME_PROPERTIES_TO_CONVERT,
    UNITS
};
