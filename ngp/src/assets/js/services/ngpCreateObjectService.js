// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import dmsSvc from 'soa/dataManagementService';
import preferenceSvc from 'soa/preferenceService';
import soaService from 'soa/kernel/soaService';
import clientMetaModel from 'soa/kernel/clientMetaModel';
import ngpSoaSvc from 'js/services/ngpSoaService';
import vmoSvc from 'js/viewModelObjectService';
import ngpPropertyConstants from 'js/constants/ngpPropertyConstants';
import cmm from 'soa/kernel/clientMetaModel';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import dateTimeService from 'js/dateTimeService';
import popupSvc from 'js/popupService';
import ngpModelConstants from 'js/constants/ngpModelConstants';
import ngpModelUtils from 'js/utils/ngpModelUtils';
import eventBus from 'js/eventBus';
import ngpRelationService from 'js/services/ngpRelationService';
import mfeFilterAndSortService from 'js/mfeFilterAndSortService';
import addObjectUtils from 'js/addObjectUtils';
import ngpChangeMgmtValidationSvc from 'js/services/ngpChangeManagementValidationService';

/**
 * NGP Create Object service
 *
 * @module js/services/ngpCreateObjectService
 */
'use strict';


/**
 * Map of property type with its corresponding place name.
 */
const TYPE_TO_PLACE = {
    CHAR: 'stringProps',
    STRING: 'stringProps',
    STRINGARRAY: 'stringArrayProps',
    BOOLEAN: 'boolProps',
    BOOLEANARRAY: 'boolArrayProps',
    DATE: 'dateProps',
    DATEARRAY: 'dateArrayProps',
    OBJECT: 'tagProps',
    OBJECTARRAY: 'tagArrayProps',
    DOUBLE: 'doubleProps',
    DOUBLEARRAY: 'doubleArrayProps',
    INTEGER: 'intProps',
    INTEGERARRAY: 'intArrayProps'
};
const typeNameToAGList = [];
const SEPARATOR_TITLE = '|';

/**
 * extract and save CurrentXrtData
 * @param {Object} viewModelData of the view model
 * @returns (Object)
 */
export function extractAndSaveCurrentXrtData( viewModelData, editHandler ) {
    const createObjectInfo = {
        XRTFormsInfo:viewModelData.XRTFormsInfo,
        xrtLoaded:viewModelData.xrtLoaded
    };
    const index = findDisplayedFormIndex( viewModelData.XRTFormsInfo );
    saveCurrentXrtData(  viewModelData.XRTFormsInfo[index], createObjectInfo, editHandler );
    return createObjectInfo;
}
/**
 * call create object SOA
 *
 * @param {Object} pageSelection page selected object
 * @param {Object} pageContext page context
 * @param {boolean} createSibling cretae as sibling for the selected object
 * @param {Object} viewModelData of the view model
 * @param {object} relatedObjectAG unknown
 * @param {object} objectBaseType baseType of the object being created
 * @return {Promise} a promise
 */
export function callCreateObject( pageSelection, pageContext, createSibling, viewModelData, relatedObjectAG, objectBaseType ) {
    const index = findDisplayedFormIndex( viewModelData.XRTFormsInfo );
    viewModelData.XRTFormsInfo[index].showXrt = false;
    let parentObject = pageContext ? pageContext : null;
    if ( Array.isArray( pageSelection ) && pageSelection.length > 0 ) {
        parentObject = pageSelection[0];
    }
    if ( createSibling ) {
        const parentPropName = ngpModelUtils.getParentPropertyName( parentObject );
        const newParentUid = parentObject.props[parentPropName].dbValues[0];
        parentObject = cdm.getObject( newParentUid );
    }
    const inputData = {
        input : [ {
            clientId: 'tc-mfg-web',
            data: getCreateInputData( parentObject, viewModelData, relatedObjectAG, objectBaseType )
        } ]
    };
    return ngpSoaSvc.executeSoa( 'Core-2008-06-DataManagement', 'createObjects', inputData ).then(
        ( response ) => {
            const childrenCreated = response.ServiceData.created.map( ( uid ) => cdm.getObject( uid ) )
                .filter( ( object ) => object.modelType.name === viewModelData.XRTFormsInfo[0].createType );
            if( !relatedObjectAG ) {
                eventBus.publish( 'ngp.objectCreated', {
                    parentObject,
                    childrenCreated
                } );
            }
            viewModelData.XRTFormsInfo.forEach( ( XRTFormInfo ) => XRTFormInfo.filledFormData = {} );
            if ( relatedObjectAG ) {
                ngpRelationService.createRelations( pageContext, childrenCreated[0], ngpModelConstants.ATTACHMENT_ATTRGROUP_RELATION, pageContext.uid ).then(
                    ( result ) => {
                        if ( Array.isArray( result.output ) && result.output.length > 0 ) {
                            eventBus.publish( 'ngp.AGCreated', {
                                createdAG: childrenCreated[0]
                            } );
                        }
                    } );
            }
        } );
}

/**
 * Return  the list of AG for a given tpe name
 * @param {String} typeName - the type name which attributs groups are associtae with
 * @returns {Promise} - promise which return list all types
 */
function extractAttributeGroupsToCreateWithNewObject( typeName ) {
    if ( typeNameToAGList[typeName] ) {
        return new Promise( ( resolve ) => resolve( typeNameToAGList[typeName] ) );
    }
    const inputData = {
        keys: [ {
            constantName: ngpModelConstants.AG_CREATION_TYPES,
            typeName
        } ]
    };
    return ngpSoaSvc.executeSoa( 'BusinessModeler-2007-06-Constants', 'getTypeConstantValues', inputData ).then(
        ( result ) => {
            if( result.constantValues && result.constantValues.length > 0 ) {
                typeNameToAGList[typeName] =  result.constantValues.map( ( agType ) => agType.value.split( ',' ) )[0]
                    .filter( ( value ) => value !== '' );
            } else {
                typeNameToAGList[typeName] = [];
            }
            return typeNameToAGList[typeName];
        } );
}

/**
 * create input object for create object SOA under parent
 *
 * @param {Object} parentContext parent of object of the new object
 * @param {Object} viewModelData of the view model
 * @param {Object} relatedObjectAG - the related object AG
 * @param {object} objectBaseType baseType of the object being created
 * @return {Object} input for create object SOA
 */
function getCreateInputData( parentContext,  viewModelData, relatedObjectAG, objectBaseType ) {
    viewModelData.XRTFormsInfo.forEach( ( XRTFormInfo, index ) => {
        if ( index === 0  ) {
            const parentObject = cdm.getObject( parentContext.uid );
            const tagProps =  {
                mdl0model_object: {
                    type:cdm.getObject( parentObject.props[ngpPropertyConstants.MANUFACTURING_MODEL].dbValues[0] ).type,
                    uid:parentObject.props[ngpPropertyConstants.MANUFACTURING_MODEL].dbValues[0]
                }
            };
            //in case of AG we don't need to add parentObject
            if ( !relatedObjectAG ) {
                const parentContextProppertyName = ngpModelUtils.getParentPropertyNameByType( objectBaseType );
                tagProps[parentContextProppertyName] = {
                    type:parentObject.type,
                    uid:parentObject.uid
                };
            }

            viewModelData.mainObjectToCreate =  {
                boName:  XRTFormInfo.createType,
                tagProps
            };
            //in case of AG we don't need to add compoundCreateInput
            if ( !relatedObjectAG ) {
                viewModelData.mainObjectToCreate.compoundCreateInput = { };
                viewModelData.mainObjectToCreate.compoundCreateInput[ngpPropertyConstants.ATTACHED_ATTRIBUTE_GROUPS_PROPERTY_NAME] = [];
            }
            setPropsForXRTObject( XRTFormInfo, viewModelData.mainObjectToCreate );
        } else {
            const attGroupObject = createAGCreateObject( viewModelData, XRTFormInfo );
            viewModelData.mainObjectToCreate.compoundCreateInput[ngpPropertyConstants.ATTACHED_ATTRIBUTE_GROUPS_PROPERTY_NAME].push( attGroupObject );
        }
    } );
    return viewModelData.mainObjectToCreate;
}
/**
 * in case we have dpendend AG for a given object we need to create relevant data for it
 * for the soa input
 * @param {object} viewModelData model data
 * @param {object} XRTFormInfo xrt info
 * @return {object} the AG object data
 */
function createAGCreateObject( viewModelData, XRTFormInfo ) {
    const tagProps = {
        mdl0model_object:  viewModelData.mainObjectToCreate.tagProps.mdl0model_object
    };
    const attGroupObject = {
        boName:  XRTFormInfo.createType,
        tagProps
    };
    setPropsForXRTObject( XRTFormInfo, attGroupObject );
    return attGroupObject;
}

/**
 * Extract the value form the XRT to create object soa input
 * @param {object} XRTFormInfo xrt form info
 * @param {object} objectToCreate this is the creation object for soa input
 */
function setPropsForXRTObject( XRTFormInfo, objectToCreate ) {
    Object.getOwnPropertyNames( XRTFormInfo.filledFormData ).forEach( ( property )=>{
        const propertyValue = XRTFormInfo.filledFormData[property];
        const valueTypeKey = TYPE_TO_PLACE[propertyValue.type];
        if ( !objectToCreate[valueTypeKey] ) {
            objectToCreate[valueTypeKey] = {};
        }
        if ( valueTypeKey.indexOf( 'date' ) > -1 ) {
            const dateObject = new Date( propertyValue.dbValue );
            objectToCreate[valueTypeKey][property] = dateTimeService.formatUTC( dateObject );
        }else{
            objectToCreate[valueTypeKey][property] = propertyValue.dbValue;
        }
    } );
}

/**
  * extract type list from given prefernce.
  *
  * @param {String} prefName - the prefernce that save the list of types
  * @param {String} objectBaseType - the base type that is relevant to creation
  * @param {object} relatedObjectAG - related model object for new AG
  * @returns {String[]} list of types that can be created
  */
export function getCreatableItemTypes( prefName, objectBaseType, relatedObjectAG ) {
    if ( relatedObjectAG ) {
        return getAllowedAgTypesToCreate( objectBaseType, relatedObjectAG );
    }
    const prefNames = [ prefName ];
    return preferenceSvc.getStringValues( prefNames ).then(
        ( values ) => {
            if( values && values.length > 0 && values[ 0 ] !== null ) {
                return getAvailableModelTypes( objectBaseType, values, true );
            }
            //Handle the case when value is empty
            return getDefaultAvailableModelTypes( objectBaseType );
        } );
}

/**
 * Check for allowed types for a given model object
 * @param {String} objectBaseType - the base type that is relevant to creation
 * @param {object} relatedObjectAG - related model object for new AG
 * @returns {String[]} list of types that can be created
 */
function getAllowedAgTypesToCreate( objectBaseType, relatedObjectAG ) {
    const inputData = {
        attachedToTypes: [ relatedObjectAG.modelType ]
    };

    return ngpSoaSvc.executeSoa( 'ManufacturingCore-2017-05-DataManagement', 'getAllowedAttributeGroupTypes', inputData ).then(
        ( results )=>{
            const values = results.output[0].validAGTypes;
            if( values && values.length > 0 && values[ 0 ] !== null ) {
                const listOfTypes = values.map( ( value )=>{
                    return value.props.type_name.dbValues[0];
                } );
                return getAvailableModelTypes( objectBaseType, listOfTypes, true );
            }
        } );
}
/**
 * This method returns the available type based on preference values
 * @param { String } objectBaseTypeName - Object Base Type
 * @param { StringArray } listOfTypes - list of possible types,
 * @param { boolean } listOfTypesFromPrefernce - flag to indicate the source of list
 * @return {VMO[]} - List of VMO for types value
 */
function getAvailableModelTypes( objectBaseTypeName, listOfTypes, listOfTypesFromPrefernce ) {
    return soaService.ensureModelTypesLoaded( listOfTypes ).then(
        () => {
            const validTypesUids = [];
            listOfTypes.forEach( ( typeName ) => {
                const modelType = clientMetaModel.getType( typeName );
                if( cmm.isInstanceOf( objectBaseTypeName, modelType ) ) {
                    validTypesUids.push( modelType.uid );
                }
            } );
            if( validTypesUids.length > 0 ) {
                return dmsSvc.loadObjects( validTypesUids ).then(
                    () => {
                        const sortCriteria = [ {
                            fieldName : ngpPropertyConstants.TYPE_NAME,
                            sortDirection : 'ASC'
                        } ];
                        const modelObjects = validTypesUids.map( ( uid ) =>  cdm.getObject( uid ) );
                        const sortedArray = mfeFilterAndSortService.sortModelObjects( modelObjects, sortCriteria );
                        return sortedArray.map( ( obj ) => {
                            const vmo =  vmoSvc.constructViewModelObject( obj );
                            if ( !vmo.props.type_name.uiValue ) {
                                vmo.props.type_name.uiValue = obj.props.type_name.uiValues[0];
                            }
                            return vmo;
                        } );
                    } );
            }
            if( listOfTypesFromPrefernce ) {
                return getDefaultAvailableModelTypes( objectBaseTypeName );
            }
            //this line is relevnt in case no type found
            return [];
        } );
}

/**
 * This method returns the available type based on object type
 * @param { String } objectBaseType - Object base type
 * @return {VMO[]} - List of VMO for types value
 */
function getDefaultAvailableModelTypes( objectBaseType ) {
    const inputData = [];
    const soaInputObject = {
        boTypeName : objectBaseType,
        exclusionBOTypeNames:[]
    };
    inputData.push( soaInputObject );
    return ngpSoaSvc.executeSoa( 'Core-2010-04-DataManagement', 'findDisplayableSubBusinessObjectsWithDisplayNames', inputData ).then(
        ( result ) => {
            if( result.output ) {
                const typesList = [];
                result.output.forEach( ( out ) => {
                    const typeInfos = out.displayableBOTypeNames;
                    if( typeInfos ) {
                        typeInfos.forEach( ( typeInfo ) => {
                            typesList.push( typeInfo.boName );
                        } );
                    }
                } );
                return getAvailableModelTypes( objectBaseType, typesList, false );
            }
        } );
}

/**
 *
 * @param {Object}  viewModelData view model data
 * @param {VMO} selectedType arry of view model object
 */
export function handleTypeSelection( viewModelData, selectedType ) {
    const localData = viewModelData.getData();
    const selectedTypeInfo = {
        selectedMode : localData.selectedMode,
        xrtLoaded : localData.xrtLoaded,
        XRTFormsInfo : localData.XRTFormsInfo
    };
    if( selectedType ) {
        return  extractAttributeGroupsToCreateWithNewObject( selectedType.props.type_name.dbValues[0] ).then(
            ( types )=> {
                const objectTypeName = viewModelData.dataProviders.allowedTypesToCreateDataProvider.selectedObjects[0].props.type_name.dbValues[0];
                const baseModelType = clientMetaModel.getType( objectTypeName );
                return soaService.ensureModelTypesLoaded( types ).then( ()=> {
                    selectedTypeInfo.XRTFormsInfo = [ {
                        name:objectTypeName,
                        showXrt:true,
                        filledFormData:{},
                        title:  types.length > 0 ?  `${baseModelType.displayName} ${SEPARATOR_TITLE} ${viewModelData.i18n.baseProperties}` : `${baseModelType.displayName}`
                    } ];
                    if ( types.length > 0 ) {
                        selectedTypeInfo.XRTFormsInfo.push( ...types.map( ( type ) =>  {
                            const modelType = clientMetaModel.getType( type );
                            return {
                                name:type,
                                showXrt:false,
                                filledFormData:{},
                                title: `${baseModelType.displayName} ${SEPARATOR_TITLE} ${modelType.displayName}`
                            };
                        } ) );
                    }
                    selectedTypeInfo.selectedMode = 'xrt';
                    selectedTypeInfo.xrtLoaded = false;

                    return selectedTypeInfo;
                } );
            } );
    }
    return new Promise( ( res ) => res( selectedTypeInfo ) );
}

/**
 * check if there is only one element in list
 * select it and chnage mode to xrt
 * or change to list mode
 *
 * @param {Object} viewModelData view model data
 */
export function checkIfSingleResultAndSelectionStatus( viewModelData ) {
    const selectionObject = {
        selectedMode : 'list',
        xrtLoaded : true,
        singleTypeSelection : false,
        XRTFormsInfo : viewModelData.XRTFormsInfo
    };
    const vmc = viewModelData.dataProviders.allowedTypesToCreateDataProvider.viewModelCollection;
    if ( vmc.totalFound === 1 ) {
        selectionObject.selectedMode = 'xrt';
        selectionObject.xrtLoaded = false;
        selectionObject.singleTypeSelection = true;
        const selected = vmc.getViewModelObject( 0 );
        viewModelData.dataProviders.allowedTypesToCreateDataProvider.selectionModel.setSelection( selected );
        if( viewModelData.XRTFormsInfo && viewModelData.XRTFormsInfo[0] ) {
            selectionObject.XRTFormsInfo[0].showXrt = true;
        }
    }else {
        viewModelData.dataProviders.allowedTypesToCreateDataProvider.selectionModel.selectNone();
        selectionObject.selectedMode = 'list';
    }

    return selectionObject;
}
/***
 * switch next xrt view to show and hide back view
 *
 * @param {Object} viewModelData model data
 */
export function showNextXRTForm( viewModelData, editHandler ) {
    const nextXRTInfo = {
        XRTFormsInfo:viewModelData.XRTFormsInfo,
        xrtLoaded:viewModelData.xrtLoaded
    };
    const index = findDisplayedFormIndex( viewModelData.XRTFormsInfo );
    if ( index < nextXRTInfo.XRTFormsInfo.length - 1 ) {
        nextXRTInfo.xrtLoaded = false;
        saveCurrentXrtData(  nextXRTInfo.XRTFormsInfo[index], nextXRTInfo, editHandler );
        nextXRTInfo.XRTFormsInfo[index].showXrt = false;
        nextXRTInfo.XRTFormsInfo[index + 1].showXrt = true;
    }
    return nextXRTInfo;
}
/***
 * switch back xrt view to show and hide next view
 *
 * @param {Object} viewModelData model data
 */
export function showPreviousForm( viewModelData, editHandler ) {
    const prevXRTInfo = {
        XRTFormsInfo: viewModelData.XRTFormsInfo,
        selectedMode: viewModelData.selectedMode,
        xrtLoaded: viewModelData.xrtLoaded
    };
    const index = findDisplayedFormIndex( viewModelData.XRTFormsInfo );
    if ( index > 0 ) {
        prevXRTInfo.xrtLoaded = false;
        saveCurrentXrtData(  viewModelData.XRTFormsInfo[index], prevXRTInfo, editHandler );
        prevXRTInfo.XRTFormsInfo[index].showXrt = false;
        prevXRTInfo.XRTFormsInfo[index - 1].showXrt = true;
    }
    if ( index === 0 ) {
        prevXRTInfo.selectedMode = 'list';
        prevXRTInfo.XRTFormsInfo[index].showXrt = false;
    }

    return prevXRTInfo;
}
/**
 * set the data that the user enterd in case of back/next scenario
 *
 * @param {object} viewModelData view model data
 */
export function updateXrtAfterLoading( viewModelData, editHandler ) {
    const updatedXRTInfo = {
        XRTFormsInfo : viewModelData.XRTFormsInfo,
        xrtLoaded: true,
        filledFormData:null
    };
    const index = findDisplayedFormIndex( viewModelData.XRTFormsInfo );
    if ( index >= 0 && updatedXRTInfo.XRTFormsInfo[index].filledFormData ) {
        const filledFormData = updatedXRTInfo.XRTFormsInfo[index].filledFormData;

        if ( filledFormData && Object.getOwnPropertyNames( filledFormData ) ) {
            const viewModelsProps =   Object.getOwnPropertyNames( filledFormData ).map(
                ( val ) => filledFormData[val]
            );
            addObjectUtils.assignInitialValues( viewModelsProps,  updatedXRTInfo.XRTFormsInfo[index].name, editHandler );
        }
    }


    return updatedXRTInfo;
}
/**
 * Find selected index in XRTFormsInfo
 *
 * @param {object} XRTFormsInfo view model data array
 * @return {Number} out of the possible displayed forms, the index of the one which is displayed
 */
function findDisplayedFormIndex( XRTFormsInfo ) {
    return  _.findIndex( XRTFormsInfo, ( XRTFormInfo ) => XRTFormInfo.showXrt );
}
/**
 * Save xrt data in order to be able to go next/back and edit the information already filled
 *
 * @param {object} XRTFormInfo an object to contain the data of the current xrt
 * @param {object} targetObject an object to save data
 */
function saveCurrentXrtData(  XRTFormInfo, targetObject, editHandler ) {
    XRTFormInfo.filledFormData = {};
    const selectedType = {
        dbValue:XRTFormInfo.name
    };

    targetObject.objCreateInfo = addObjectUtils.getObjCreateInfo( selectedType, editHandler );

    XRTFormInfo.createType = targetObject.objCreateInfo.createType;
    targetObject.objCreateInfo.props.forEach( ( vmProp ) => {
        XRTFormInfo.filledFormData[vmProp.propertyName] = vmProp;
    } );
}


/**
 *
 * @param {string} dialogTitle - the title of the dialog
 * @param {string} baseType - the base type of the type we want to create
 * @param {string} allowedTypesToCreatePreference - the preference which states what types user is allowed to create
 * @param {modelObject[]} pageSelection - the selected objects
 * @param {modelObject} pageContext - the context of the page
 * @param {boolean} createSibling - true if we need to create a sibling object
 */
export function displayCreateObjectDialog( dialogTitle, baseType, allowedTypesToCreatePreference, pageSelection, pageContext, createSibling ) {
    let modelObject = pageContext ? pageContext : null;
    if ( Array.isArray( pageSelection ) && pageSelection.length > 0 ) {
        modelObject = pageSelection[0];
    }
    if( modelObject ) {
        ngpChangeMgmtValidationSvc.validateUserCanCreateObjects( modelObject ).then(
            ( canPerformChange ) => {
                if( canPerformChange ) {
                    const popupData = {
                        options: {
                            view:'NgpCreateObjectWizard',
                            height: '500',
                            width: '500',
                            clickOutsideToClose: false,
                            caption: dialogTitle,
                            preset: 'modal',
                            independent: true,
                            subPanelContext:{
                                baseType,
                                preference: allowedTypesToCreatePreference,
                                pageSelection,
                                pageContext,
                                createSibling,
                                relatedObjectAG : baseType === ngpModelConstants.AG_TYPE ? pageContext : null
                            }
                        }
                    };
                    popupSvc.show( popupData );
                }
            }
        );
    }
}

/**
 *
 * @param {string} message - the create message
 * @param {string} nameParam - the name parameter to add to the message
 * @return {string} the string concatenated with the paramater
 */
export function setCreatingMsg( message, nameParam ) {
    return nameParam ? message.format( nameParam ) : message.format( '' );
}

let exports = {};
export default exports = {
    displayCreateObjectDialog,
    getCreatableItemTypes,
    handleTypeSelection,
    checkIfSingleResultAndSelectionStatus,
    showNextXRTForm,
    showPreviousForm,
    updateXrtAfterLoading,
    callCreateObject,
    setCreatingMsg,
    extractAndSaveCurrentXrtData
};
