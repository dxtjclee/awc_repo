// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import ngpSoaSvc from 'js/services/ngpSoaService';
import ngpTypeUtils from 'js/utils/ngpTypeUtils';
import ngpPropConstants from 'js/constants/ngpPropertyConstants';
import ngpLoadSvc from 'js/services/ngpLoadService';
import ngpModelUtils from 'js/utils/ngpModelUtils';
import ngpNavigationSvc from 'js/services/ngpNavigationService';
import ngpChangeMgmtValidationSvc from 'js/services/ngpChangeManagementValidationService';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import appCtxSvc from 'js/appCtxService';
import listBoxSvc from 'js/listBoxService';

import _ from 'lodash';
import localeSvc from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';

const localizedMessages = localeSvc.getLoadedText( 'NgpDataMgmtMessages' );

/**
 * The ngp workflow service
 *
 * @module js/services/ngpWorkflowService
 */
'use strict';

/**
 *
 * @returns {String} the value of the CR_allow_alternate_procedures preference
 */
function getPrefValue() {
    let prefValue = 'none';
    if( appCtxSvc.ctx.preferences.CR_allow_alternate_procedures && appCtxSvc.ctx.preferences.CR_allow_alternate_procedures[ 0 ] ) {
        prefValue = appCtxSvc.ctx.preferences.CR_allow_alternate_procedures[ 0 ];
    }
    return prefValue;
}

/**
 *
 * @param {modelObject[]} modelObjects - a given array of modelObjects
 * @return {Promise}  a promise object
 */
export function getWorkflowTemplates( modelObjects ) {
    if( Array.isArray( modelObjects ) ) {
        const targetObjects = modelObjects.filter( ( obj ) => Boolean( obj ) );
        if( targetObjects.length > 0 ) {
            const input = [ {
                clientId: 'filteredTemplates',
                getFiltered: true,
                targetObjects
            } ];
            const prefValue = getPrefValue();
            if( prefValue !== 'none' ) {
                input.push( {
                    clientId: 'allTemplates',
                    getFiltered: false,
                    targetObjects
                } );
            }
            return ngpSoaSvc.executeSoa( 'Workflow-2013-05-Workflow', 'getWorkflowTemplates', { input } ).then(
                ( response ) => response.templatesOutput
            );
        }
    }
    return new Promise( ( resolve ) => {
        resolve( [] );
    } );
}

/**
 *
 * @param {Object} workflowTemplatesData output from getWorkflowTemplates SOA
 * @return {Object} Object with data that is needed by the dialog
 */
export function initializeData( workflowTemplatesData ) {
    let allTemplates = [];
    let filteredTemplates = [];
    if( workflowTemplatesData.length > 0 ) {
        workflowTemplatesData.forEach( ( element ) => {
            if( element.clientId === 'allTemplates' ) {
                allTemplates = element.workflowTemplates;
            } else if( element.clientId === 'filteredTemplates' ) {
                filteredTemplates = element.workflowTemplates;
            }
        } );
    }
    allTemplates = listBoxSvc.createListModelObjects( allTemplates, 'props.template_name' );
    filteredTemplates = listBoxSvc.createListModelObjects( filteredTemplates, 'props.template_name' );

    let allowAlternateProcedures = false;
    const prefValue = getPrefValue();
    if( prefValue === 'none' ) {
        allowAlternateProcedures = false;
    } else if( prefValue === 'any' ) {
        allowAlternateProcedures = true;
    } else if( prefValue === 'Assigned' ) {
        allowAlternateProcedures = false;
    }

    return {
        allTemplates,
        filteredTemplates,
        allowAlternateProcedures
    };
}

/**
 * Get list of templates based on radio button selection and CR_allow_alternate_procedures preference value
 * @param {Boolean} getAllTemplates - return all templates if true and filtered templates if false
 * @param {ObjectArray} allTemplates - Array of ListModel objects of all templates
 * @param {ObjectArray} filteredTemplates - Array of ListModel objects of filtered templates
 * @param {ViewModelProperty} workflowTemplatesLabel - the workflow template property object
 * @return {ObjectArray} Array of ListModel objects of the templates to show
 */
export function getValidTemplates( getAllTemplates, allTemplates, filteredTemplates, workflowTemplatesLabel ) {
    var propDBValue = null;
    var propUiValue = '';
    let workflowTemplatesList = [];
    if( getAllTemplates ) {
        workflowTemplatesList = allTemplates;
    } else {
        workflowTemplatesList = filteredTemplates;
    }
    if( workflowTemplatesList.length > 0 ) {
        propDBValue = workflowTemplatesList[ 0 ].propInternalValue;
        propUiValue = workflowTemplatesList[ 0 ].propDisplayValue;
    }
    let workflowNameProp = { ...workflowTemplatesLabel };
    workflowNameProp.dbValue = propDBValue;
    workflowNameProp.uiValue = propUiValue;
    return {
        workflowTemplatesList,
        workflowNameProp
    };
}

/**
 *
 * @param {IModelObject[]} workflowCandidates - the array of candidates
 * @param {string} name - the workflow name
 * @param {string} processTemplate - the workflow template name
 * @param {string} description - the workflow description
 * @param {boolean} startImmediately - true if should start immediately
 * @param {string} subject - the subject
 * @return {Promise} a promise object
 */
export function createWorkflowProcess( workflowCandidates, name, processTemplate, description, startImmediately = true, subject = '' ) {
    const uids = workflowCandidates.map( ( object ) => object.uid );
    const attachmentTypes = workflowCandidates.map( () => 1 );
    const soaInput = {
        startImmediately,
        observerKey: '',
        name,
        subject,
        description,
        contextData: {
            processTemplate,
            attachmentCount: uids.length,
            attachments: uids,
            attachmentTypes
        }
    };
    return ngpSoaSvc.executeSoa( 'Workflow-2008-06-Workflow', 'createInstance', soaInput ).then(
        ( response ) => {
            eventBus.publish( 'ngp.submitToWorkflow', {
                updatedObjects: response.ServiceData.updated
            } );
            return response;
        },
        () => false
    );
}

/**
 * This method should be used to revise the scope object only
 * @param {modelObject} modelObject - an array of modelObjects to revise
 */
export function reviseScopeObject( modelObject ) {
    ngpChangeMgmtValidationSvc.validateUserCanPerformChange( [ modelObject ] ).then(
        ( canPerformChange ) => {
            if( canPerformChange ) {
                if( ngpTypeUtils.isOperation( modelObject ) ) {
                    const parentUid = modelObject.props[ ngpPropConstants.PARENT_OF_OPERATION ].dbValues[ 0 ];
                    const parentObj = cdm.getObject( parentUid );
                    if( ngpModelUtils.isReleased( parentObj ) ) {
                        //if parent of operation is released, then we need to display a confirmation
                        displayParentAutoReviseConfirmation( modelObject, parentObj );
                        return;
                    }
                }
                reviseAndAttemptNavigation( modelObject );
            }
        }
    );
}

/**
 * @param { ModelObject } reviseCandidateModelObj - the model object which is candidate to be revised
 * @param { ModelObject } parentObject - the parent object of the revised candidate
 */
function displayParentAutoReviseConfirmation( reviseCandidateModelObj, parentObject ) {
    const msg = localizedMessages.parentAutoReviseSingleConfirmation.format(
        reviseCandidateModelObj.props[ ngpPropConstants.OBJECT_STRING ].uiValues[ 0 ],
        parentObject.props[ ngpPropConstants.OBJECT_STRING ].uiValues[ 0 ] );
    mfgNotificationUtils.displayConfirmationMessage( msg, localizedMessages.continue, localizedMessages.cancel ).then(
        () => {
            reviseAndAttemptNavigation( reviseCandidateModelObj );
        }
    );
}

/**
 * Revises the given modelObject and navigates to the configured navigation once it finished
 * @param {modelObject} modelObject - a given modelObject
 */
function reviseAndAttemptNavigation( modelObject ) {
    revise( [ modelObject ] ).then(
        () => {
            ngpNavigationSvc.navigateToConfiguredRevision( modelObject,
                localizedMessages.successfulReviseAction.format( modelObject.props[ ngpPropConstants.OBJECT_NAME ].uiValues[ 0 ] ) );
        }
    );
}

/**
 *
 * @param {modelObject[]} modelObjects - an array of modelObjects to revise
 * @return {promise} a promise object
 */
function revise( modelObjects ) {
    const reviseObjArray = modelObjects.map( ( object ) => ( {
        object,
        operation: 'Revise'
    } ) );
    const soaInput = {
        deepCopyDataInput: reviseObjArray
    };
    return ngpSoaSvc.executeSoa( 'Core-2012-02-OperationDescriptor', 'getDeepCopyData', soaInput )
        .then(
            ( response ) => {
                if( response.deepCopyInfoMap ) {
                    const reviseCandidatesArray = response.deepCopyInfoMap[ 0 ];
                    const deepCopyDataArray = _.cloneDeep( response.deepCopyInfoMap[ 1 ] );
                    deepCopyDataArray.forEach( ( deepCopyData ) => {
                        deepCopyData.forEach( ( data ) => {
                            modifyDeepCopyData( data );
                        } );
                    } );
                    return {
                        reviseCandidatesArray,
                        deepCopyDataArray
                    };
                }
            }
        )
        .then(
            ( { reviseCandidatesArray, deepCopyDataArray } ) => {
                const reviseObjects = reviseCandidatesArray.map( ( candidate, i ) => {
                    return {
                        targetObject: candidate,
                        deepCopyDatas: deepCopyDataArray[ i ],
                        reviseInputs: {}
                    };
                } );
                const soaInput = {
                    reviseIn: reviseObjects
                };
                return ngpSoaSvc.executeSoa( 'Core-2013-05-DataManagement', 'reviseObjects', soaInput );
            }
        )
        .then(
            ( response ) => {
                if( response && response.reviseTrees ) {
                    return response.reviseTrees;
                }
            }
        );
}

/**
 * Modifies the given deep copy data
 * @param {object} data - the deep copy data
 */
function modifyDeepCopyData( data ) {
    delete data.saveAsInput;
    data.attachedObject = {
        uid: data.attachedObject.uid,
        type: data.attachedObject.type
    };
    if( data.childDeepCopyData ) {
        data.childDeepCopyData.forEach( ( childData ) => {
            modifyDeepCopyData( childData );
        } );
    }
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {promise} a promise object
 */
export function getDiscontinuedAndNotReleasedProcessesUids( modelObject ) {
    if( ngpTypeUtils.isActivity( modelObject ) ) {
        return ngpLoadSvc.getPropertiesAndLoad( [ modelObject.uid ], [ ngpPropConstants.DISCONTINUED_PROCESSES ] ).then(
            () => {
                const removedProcessesUids = modelObject.props[ ngpPropConstants.DISCONTINUED_PROCESSES ].dbValues;
                return removedProcessesUids.filter( ( uid ) => {
                    let process = cdm.getObject( uid );
                    return !ngpModelUtils.isReleased( process );
                } );
            }
        );
    }

    return new Promise( ( resolve, reject ) => {
        resolve( [] );
    } );
}

let exports;
export default exports = {
    getWorkflowTemplates,
    getValidTemplates,
    initializeData,
    createWorkflowProcess,
    reviseScopeObject,
    getDiscontinuedAndNotReleasedProcessesUids
};
