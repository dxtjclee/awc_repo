// Copyright (c) 2022 Siemens

/**
 * Service for attaching files to an object.
 *
 * @module js/services/ngpAttachFileService
 */
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import listBoxSvc from 'js/listBoxService';
import ngpSoaSvc from 'js/services/ngpSoaService';
import localeService from 'js/localeService';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import msgSvc from 'js/messagingService';
import preferenceService from 'soa/preferenceService';
import cmm from 'soa/kernel/clientMetaModel';
import popupSvc from 'js/popupService';
import AwPromiseService from 'js/awPromiseService';
import mfePolicySvc from 'js/mfePolicyService';
import ngpRelationSvc from 'js/services/ngpRelationService';

const NGP_Dataset_AllowedRelationTypes = 'NGP_Dataset_AllowedRelationTypes';
let uidToValidTypes = {};
let allowedDatasetsWithTheirRelations = {};
let relationDisplayNameToDBNameMap = {};
const localizedMsgs = localeService.getLoadedText( 'ngpInformationMessages' );

const poslicyObj = {
    types: [ {
        name: 'DatasetType',
        properties: [ {
            name: 'datasettype_name'
        } ]
    } ]
};

/**
 * @param {String} fileName - file name
 * @returns {String} returns file extension
 */
function getExtension( fileName ) {
    const extensionIndex = fileName.lastIndexOf( '.' );
    if( extensionIndex > -1 ) {
        return fileName.substring( extensionIndex + 1 );
    }
}

/**
 * Reset the input UI component values
 * @param {String} fileName - file name
 * @param {modelObject} scopeObject - scopeObject
 * @returns {Promise} returns values for listOfDatasetTypes, relationList, fileExt, selectedDatasetIndex
 */
export function initiateDatasetWithRelationDefinition( fileName, scopeObject ) {
    const fileExtension = getExtension( fileName );
    if( fileExtension ) {
        if( allowedDatasetsWithTheirRelations[ fileExtension ] ) {
            const listOfDataSets = listBoxSvc.createListModelObjectsFromStrings( getDatasetList( fileExtension ) );
            const result = onDatasetSelectionChange( listOfDataSets[ 0 ], fileExtension, 0 );

            return new Promise( ( res ) => {
                res( {
                    listOfDatasetTypes: listOfDataSets,
                    relationList: result.relationList,
                    fileExt: fileExtension,
                    selectedDatasetIndex: 0,
                    valueForDatasetTypesListBox: listOfDataSets[ 0 ].propDisplayValue,
                    referenceName: result.referenceName,
                    datasetDBName: result.datasetDBName
                } );
            } );
        }

        mfePolicySvc.register( 'ngpAttachFileDialog', poslicyObj );
        return getDatasetTypesWithDefaultRelation( scopeObject, fileExtension ).then( ( getDatasetTypesResponse ) => {
            if( getDatasetTypesResponse ) {
                const output = getDatasetTypesResponse.output[ 0 ];
                getAllowedDatasetsOfSelectedFile( output.datasetTypesWithDefaultRelInfo, scopeObject.modelType.uid, fileExtension );

                mfePolicySvc.unregister( 'ngpAttachFileDialog' );
                const listOfDataSets = listBoxSvc.createListModelObjectsFromStrings( getDatasetList( fileExtension ) );
                const result = onDatasetSelectionChange( listOfDataSets[ 0 ], fileExtension, 0 );
                return {
                    listOfDatasetTypes: listOfDataSets,
                    relationList: result.relationList,
                    fileExt: fileExtension,
                    selectedDatasetIndex: 0,
                    valueForDatasetTypesListBox: listOfDataSets[ 0 ].propDisplayValue,
                    referenceName: result.referenceName,
                    datasetDBName: result.datasetDBName
                };
            }
        } );
    }
    return new Promise( ( res ) => {
        res( {
            listOfDatasetTypes: [],
            relationList: [],
            fileExt: '',
            selectedDatasetIndex: 0
        } );
    } );
}

/**
 * @param {String} extension - a given file extension
 * @return {object[]} retuns the list of datasets which fit the current selected file
 */
function getDatasetList( extension ) {
    if( allowedDatasetsWithTheirRelations ) {
        return allowedDatasetsWithTheirRelations[ extension ].map( ( datasetWithRelations ) => datasetWithRelations.dataset.displayValue );
    }
    return [];
}

/**
 * @param {String} fileExtension - file extension
 * @param {Number} datasetIndex - index of the dataset in the dataset list
 * @return {object[]} retuns the list of relations which fit the current selected file
 */
function getRelationsList( fileExtension, datasetIndex ) {
    if( allowedDatasetsWithTheirRelations ) {
        const selectedRelations = allowedDatasetsWithTheirRelations[ fileExtension ][ datasetIndex ];
        return selectedRelations.relations.map( ( relation ) => relation.displayValue );
    }
    return [];
}

/**
 * Get dataset types supported for the file
 * @param {modelObject} scopeObject - scopeObject
 * @param {String} fileExt - file extension
 * @returns {Promise} returns dataset types with their relations
 */
function getDatasetTypesWithDefaultRelation( scopeObject, fileExt ) {
    const request = {
        fileExtensions: [ fileExt ],
        parent: {
            type: scopeObject.type,
            uid: scopeObject.uid
        }
    };
    return ngpSoaSvc.executeSoa( 'Internal-AWS2-2015-10-DataManagement', 'getDatasetTypesWithDefaultRelation', request );
}

/**
 * Prepare data for displaying the dialog
 * @param {modelObject} context - the context modelObject
 * @returns {Promise} returns allowed dataset types for the context object
 */
export function prepareDataForDisplayAttachFileDialog( context ) {
    return getAllowedDatasetTypes( context ).then( ( allowedTypes ) => {
        if( !_.isEmpty( allowedTypes ) ) {
            ensureRelationTypesLoaded();
            displayCreateDatasetDialog( context );
        } else {
            displayAttachError( context );
        }
    } );
}

/**
 * Get the allowed file types.
 * @param {modelObject} context - the context modelObject
 * @returns {Promise} returns allowed dataset types for the context object
 */
export function getAllowedDatasetTypes( context ) {
    if( context ) {
        let modelTypeUid = context.modelType.uid;
        if( uidToValidTypes[ context.modelType.uid ] ) {
            return new Promise( ( resolve ) => resolve( uidToValidTypes[ context.modelType.uid ] ) );
        }
        const soaInput = {
            attachedToTypes: [ context.modelType ]
        };
        return ngpSoaSvc.executeSoa( 'ManufacturingCore-2017-05-DataManagement', 'getAllowedDatasetTypes', soaInput ).then(
            ( response ) => {
                if( response ) {
                    response.output.forEach( ( output ) => {
                        modelTypeUid = output.attachedToType.uid;
                        uidToValidTypes[ modelTypeUid ] = {};
                        const arrayOfDatasets = output.datasetInfoMap[ 0 ];
                        const arrayOfRelationsArray = output.datasetInfoMap[ 1 ];
                        arrayOfDatasets.forEach( ( dataSet, i ) => {
                            const relations = arrayOfRelationsArray[ i ].map( ( relation ) => relation.uid );
                            uidToValidTypes[ modelTypeUid ][ dataSet.props.object_string.dbValues[ 0 ] ] = relations;
                        } );
                    } );
                }
                return uidToValidTypes[ modelTypeUid ];
            }
        );
    }
}

/**
 * Displays Create Dataset dialog.
 * @param {modelObject} context - the context modelObject
 */
function displayCreateDatasetDialog( context ) {
    popupSvc.show( {
        declView: 'NgpAttachFileDialog',
        locals: {
            caption: localizedMsgs.attachFile
        },
        options: {
            width: '400'
        },
        subPanelContext: {
            scopeObject: context
        }
    } );
}

/**
 * Displays error in case we can't create dataset.
 * @param {modelObject} context - the context modelObject
 */
function displayAttachError( context ) {
    const contextObjectDisplayName = context.props[ ngpPropConstants.OBJECT_STRING ].uiValues[ 0 ];
    let cannotAttachMessage = localizedMsgs.cannottAttachFiles.format( contextObjectDisplayName );
    msgSvc.showError( cannotAttachMessage );
}

/**
 * Ensures that the allowed dataset relation types are loaded.
 * The allowed dataset relations types are saved in a preference
 * Saves the map of nice name to db name for allowed relation types
 */
function ensureRelationTypesLoaded() {
    if( _.isEmpty( relationDisplayNameToDBNameMap ) ) {
        preferenceService.getStringValues( NGP_Dataset_AllowedRelationTypes ).then(
            ( allowedRelationTypes ) => {
                if( Array.isArray( allowedRelationTypes ) ) {
                    soaSvc.ensureModelTypesLoaded( allowedRelationTypes ).then( () => {
                        //get the list of display names
                        allowedRelationTypes.forEach( ( reationTypeDBName ) => {
                            const object = cmm.getType( reationTypeDBName );
                            const displayName = object.displayName;
                            relationDisplayNameToDBNameMap[ displayName ] = reationTypeDBName;
                        } );
                    } );
                }
            }
        );
    }
}

/**
 * A selector to get the allowed datasets & their relations of a given model object uid
 * @param {*} datasetTypesWithDefaultRelInfo - structure with dataset types and default relation info
 * @param {*} modelTypeUid - uid of model type
 * @param {*} fileExtension - file extension
 */
function getAllowedDatasetsOfSelectedFile( datasetTypesWithDefaultRelInfo, modelTypeUid, fileExtension ) {
    if( modelTypeUid ) {
        const allowedDatasetTypes = uidToValidTypes[ modelTypeUid ];
        if( datasetTypesWithDefaultRelInfo ) {
            const arrayOfData = [];
            datasetTypesWithDefaultRelInfo.forEach( ( dataset ) => {
                const datasetName = dataset.datasetType.props.datasettype_name.uiValues[ 0 ];
                if( allowedDatasetTypes[ datasetName ] ) {
                    const relations = [];
                    allowedDatasetTypes[ datasetName ].forEach( ( relationUid ) => {
                        const object = cmm.getType( relationUid );
                        if( object ) {
                            relations.push( {
                                object,
                                displayValue: object.displayName,
                                dbValue: object.name
                            } );
                        }
                    } );
                    arrayOfData.push( {
                        relations,
                        referenceName: dataset.refInfos[ 0 ].referenceName,
                        dataset: {
                            object: dataset.datasetType.uid,
                            displayValue: datasetName,
                            dbValue: dataset.datasetType.props.datasettype_name.dbValues[ 0 ]
                        }
                    } );
                }
            } );
            allowedDatasetsWithTheirRelations[ fileExtension ] = arrayOfData;
        }
    }
}

/**
 * This method is being executed from the drop down list
 * @param {object} selectedDataset - the dataset object that was selected.
 * @param {String} fileExtension - the dataset object that was selected.
 * @param {int} currentSelectedDatasetIndex - the index in the combobox of the selected dataset types
 * @return {Promise} promise object
 */
function onDatasetSelectionChange( selectedDataset, fileExtension, currentSelectedDatasetIndex ) {
    const extenstionToAllowedDatasetsWithRelation = allowedDatasetsWithTheirRelations[ fileExtension ];
    if( extenstionToAllowedDatasetsWithRelation ) {
        for( let i in extenstionToAllowedDatasetsWithRelation ) {
            if( extenstionToAllowedDatasetsWithRelation[ i ].dataset.displayValue === selectedDataset ) {
                currentSelectedDatasetIndex = i;
                break;
            }
        }
        const datasetsWithRelationObject = extenstionToAllowedDatasetsWithRelation[ currentSelectedDatasetIndex ];
        const listOfSelectedRelations = datasetsWithRelationObject.relations.map( ( relation ) => relation.displayValue );

        return {
            relationList: listBoxSvc.createListModelObjectsFromStrings( listOfSelectedRelations ),
            selectedDatasetIndex: currentSelectedDatasetIndex,
            referenceName: datasetsWithRelationObject.referenceName,
            datasetDBName: datasetsWithRelationObject.dataset.dbValue
        };
    }
}

/**
 *
 * @param {string} fileName - the name of the file being attached to the dataset
 * @param {string} datasetName - the dataset name to be created
 * @param {string} description - the description of the dataset
 * @param {string} datasetTypeName - the dataset type name
 * @param {string} relationTypeName - the relation type name
 * @param {string} referenceName - the reference name
 * @return {Promise} promise object
 */
function createDatasetWithFile( fileName, datasetName, description, datasetTypeName, relationTypeName, referenceName ) {
    const deferred = AwPromiseService.instance.defer();
    createDataset( fileName, datasetName, description, datasetTypeName, relationTypeName, referenceName ).then(
        ( createDatasetResponse ) => {
            const datasetOutput = createDatasetResponse.datasetOutput[ 0 ];

            const relationObjectUid = createDatasetResponse.ServiceData.created.filter( ( createdUid ) => datasetOutput.dataset.uid !== createdUid );
            const relationObject = createDatasetResponse.ServiceData.modelObjects[ relationObjectUid[ 0 ] ];
            const commitInfo = datasetOutput.commitInfo;
            let ticket;
            if( commitInfo && commitInfo[ 0 ] && commitInfo[ 0 ].datasetFileTicketInfos && commitInfo[ 0 ].datasetFileTicketInfos[ 0 ] ) {
                ticket = commitInfo[ 0 ].datasetFileTicketInfos[ 0 ].ticket;
            }
            deferred.resolve( {
                ticket,
                datasetOutput,
                relationObject
            } );
        },
        ( error ) => {
            deferred.resolve( {
                createDatasetErrors: error
            } );
        }
    );
    return deferred.promise;
}
/**
 *
 * @param {string} fileName - the name of the file being attached to the dataset
 * @param {string} datasetName - the dataset name to be created
 * @param {string} description - the description of the dataset
 * @param {string} datasetTypeName - the dataset type name
 * @param {string} relationTypeName - the relation type name
 * @param {string} referenceName - the reference name
 * @return {Promise} promise object
 */
function createDataset( fileName, datasetName, description, datasetTypeName, relationTypeName, referenceName ) {
    const input = [ {
        clientId: datasetName,
        name: datasetName,
        description,
        type: datasetTypeName,
        relationType: '',
        container: null,
        datasetFileInfos: [ {
            fileName,
            namedReferenceName: referenceName,
            isText: datasetTypeName.toLowerCase() === 'text'
        } ]
    } ];
    return ngpSoaSvc.executeSoa( 'Core-2010-04-DataManagement', 'createDatasets', { input } );
}

/**
 * Updates fmsTicket field in html data
 * @param {object} viewModelData  - view model data
 */
function updateFormData( viewModelData ) {
    if( !viewModelData.ticket ) {
        return;
    }
    viewModelData.formData.append( 'fmsTicket', viewModelData.ticket );
}

/**
 *
 * @param {object} datasetOutput - this is the dataset output which returned from the create dataset
 * @return {Promise} promise object
 */
function commitDatasetFiles( datasetOutput ) {
    const deferred = AwPromiseService.instance.defer();
    const { ticket, datasetFileInfo: { allowReplace, clientId, fileName, isText, namedReferenceName } } = datasetOutput.commitInfo[ 0 ].datasetFileTicketInfos[ 0 ];
    const commitInput = [ {
        createNewVersion: true,
        dataset: datasetOutput.dataset,
        datasetFileTicketInfos: [ {
            ticket,
            datasetFileInfo: {
                allowReplace,
                clientId,
                fileName,
                isText,
                namedReferencedName: namedReferenceName
            }
        } ]
    } ];

    ngpSoaSvc.executeSoa( 'Core-2006-03-FileManagement', 'commitDatasetFiles', { commitInput } ).then(
        () => {
            deferred.resolve( {} );
        },
        ( error ) => {
            deferred.resolve( {
                commitDatasetFilesError: error
            } );
        }
    );
    return deferred.promise;
}

/**
 * Creates given relation between primary and secondary object
 *
 * @param {Object} primaryObject - primary object
 * @param {Object} secondaryObject - secondary object
 * @param {String} relationTypeName - relation type between primary and secondary
 * @return {Boolean} returns true if relation is successfully created
 */
function createRelation( primaryObject, secondaryObject, relationTypeName ) {
    const deferred = AwPromiseService.instance.defer();
    ngpRelationSvc.createRelations( primaryObject, secondaryObject, relationDisplayNameToDBNameMap[ relationTypeName ], primaryObject.uid ).then(
        ( result ) => {
            if( result.output === null || result.output.length === 0 ) {
                //showErrorAndUnloadPolicy();
                deferred.resolve( {
                    createRelationError: 'error'
                } );
            } else if( result.output[ 0 ].relation !== null ) {
                deferred.resolve( {

                } );
            }
        },
        ( error ) => {
            deferred.resolve( {
                createRelationError: error
            } );
        }
    );
    return deferred.promise;
}

/**
 *
 * @param {modelObject} modelObject - a given set of relation objects
 * @param {modelObject[]} datasetObj - a given set of model objects
 * @param {String} relationTypeName - relation type between primary and secondary
 * @return {Promise} a promise
 */
function deleteDataset( modelObject, datasetObj, relationTypeName ) {
    if( datasetObj && modelObject ) {
        return ngpRelationSvc.removeRelation( datasetObj, modelObject, relationDisplayNameToDBNameMap[ relationTypeName ] ).then(
            ( response ) => {
                if( response && response.deleted && response.deleted.length > 0 ) {
                    return ngpRelationSvc.deleteObjects( [ datasetObj ] );
                }
            }
        );
    }
}

/**
 *
 * @param {*} outputData - the output data
 * @param {*} datasetNameProp - datasetName property
 * @returns {Object} the updated datasetName property
 */
export function updateDatasetName( outputData, datasetNameProp ) {
    let value = outputData.datasetName.dbValue;
    datasetNameProp.update( value );
    return outputData.datasetName;
}

let exports;
export default exports = {
    prepareDataForDisplayAttachFileDialog,
    initiateDatasetWithRelationDefinition,
    onDatasetSelectionChange,
    createDatasetWithFile,
    commitDatasetFiles,
    updateFormData,
    createRelation,
    deleteDataset,
    updateDatasetName
};
