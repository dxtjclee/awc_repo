// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for Audit from quality center foundation module
 *
 * @module js/qa0AuditUtils
 */
import appCtxService from 'js/appCtxService';
import cdmService from 'soa/kernel/clientDataModel';
import dateTimeSvc from 'js/dateTimeService';
import addObjectUtils from 'js/addObjectUtils';
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import _ from 'lodash';

var exports = {};
var eventSubs = null;
var eventSubsComplete = null;

/**
   *This method is to concat all the partialError messages if any
   */
export let failureMessageConcat = function( data ) {
    var errors = data.ServiceData.ServiceData.partialErrors[ 0 ].errorValues;
    var errorMessage = '';

    for( var i = 0; i < errors.length; i++ ) {
        errorMessage += String( errors[ i ].message );
        if( i !== errors.length - 1 ) { errorMessage += '<BR/>'; }
    }

    appCtxService.ctx.ErrorName = errorMessage;
};

/**
   * Resolve array of uids into a tag array that can be used for soa calls as tagArrayProps.
   * @param {Object} Array of object uids
   * @return {Object} Array with tag propertires
   **/
export let resolveTagArrayProps = function( arrayProp ) {
    var resolvedObject = {};
    var tagArray = [];

    if( arrayProp !== undefined || arrayProp !== '' ) {
        var objectarray = arrayProp.dbValue;

        objectarray.forEach( function( obj ) {
            resolvedObject = cdmService.getObject( obj );

            tagArray.push( { uid: resolvedObject.uid, type: resolvedObject.type } );
        } );
    }

    return tagArray;
};

/**
   * Convert datetime dbValue into input string for soa service.
   * @param {date} data - Date to convert
   * @return {string} UTC formatted string
   */
export let getDateString = function( data ) {
    if( data !== undefined && data !== '' ) {
        return dateTimeSvc.formatUTC( data.dbValue );
    }
};


export let getCreateObjectInfo = function( data, editHandler ) {
    if( !data.objCreateInfo ) {
        data.objCreateInfo = addObjectUtils.getObjCreateInfo( data.selectedType, editHandler );
    }

    let props = data.objCreateInfo.props;
    let propsStringValueObjects = {};
    let propsObjArrayValueObjects = {};
    let propsDateValueObjects = {};

    if( props.length !== 0 ) {
        _.forEach( props, function( property ) {
            let propName = property.propertyName;
            if ( property.type === 'DATE' ) {
                var dt = getDateString( property );
                propsDateValueObjects[ propName ] = dt;
            }else if( property.type === 'OBJECTARRAY' ) {
                var tagArray = resolveTagArrayProps( property );
                propsObjArrayValueObjects[ propName ] = tagArray;
            }else {
                propsStringValueObjects[ propName ] = property.dbValue;
            }
        } );
    }

    let input = [];

    input.push( {
        clientId: '',
        data: {
            boName: data.selectedType.dbValue,
            stringProps: propsStringValueObjects,
            dateProps: propsDateValueObjects,
            tagArrayProps: propsObjArrayValueObjects
        }
    } );
    return input;
};

//This function subscribe the event 'reportbuilder.generateitemreportcomplete' of report and call custom soa to attach genrated report to attachment tab of Audit
export let subscribeEventOfReport = function( ctx, data ) {
    if ( !eventSubs ) {
        eventSubs = eventBus.subscribe( 'reportbuilder.generateitemreportcomplete', function( eventData, data ) {
            if ( eventData && eventData.reportInfo ) {
                var request = {
                    attachCapaReportsInput: {
                        contextObject: ctx.selected,
                        datasetTypeToCreate: 'HTML',
                        relationName: 'Qa0AuditAttachments',
                        fmsFileTicket: eventData.reportInfo.fileTicket,
                        datasetTypeToRemove: 'CrfOutputHtml',
                        namedReferenceType: 'HTML'
                    }
                };
                soaSvc.post( 'Internal-Capaonawc-2020-05-QualityIssueManagement', 'attachCapaReports', request ).then( function( response ) {
                    eventBus.publish( 'cdm.relatedModified', {
                        refreshLocationFlag: false,
                        relatedModified: [ ctx.selected ]
                    } );
                } );
            }
        } );

        if ( !eventSubsComplete ) {
            eventSubsComplete = eventBus.subscribe( 'Awp0InContextReports.contentUnloaded', function() {
                eventBus.unsubscribe( eventSubs );
                eventBus.unsubscribe( eventSubsComplete );
                eventSubs = null;
                eventSubsComplete = null;
            } );
        }
    }
};

/**
 * This API is added to process the Partial error being thrown from the SOA
 *
 * @param {object} response - the response of SOA
 * @return {String} message - Error message to be displayed to user
 */
 export let populateErrorString = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if ( response && response.ServiceData.partialErrors ) {
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

/**
 * This API is added to form the message string from the Partial error being thrown from the SOA
 */
var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        msgObj.msg += '<BR/>';
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
 * filter objects from modified objects and tree nodes to decorate with RYG rating
 */
 export let filterObjectsForDecorators = function(treeNodes, modifiedObjects) {
    var filteredTreeNodes = [];
    var filteredModifiedObject = [];

    if (treeNodes.length > 0) {               
        filteredTreeNodes = _.filter(treeNodes, function(obj) {
            return obj.type !== 'DummyFindingsNode' && obj.modelType.typeHierarchyArray.indexOf('Psi0AbsChecklist') > -1;
        });
    } 

    if (modifiedObjects.length > 0) {          
        filteredModifiedObject = _.filter(modifiedObjects, function(obj) {
            return obj.type !== 'DummyFindingsNode' && obj.modelType.typeHierarchyArray.indexOf('Apm0RYG') > -1 || obj.modelType.typeHierarchyArray.indexOf('Psi0AbsChecklist') > -1;
        });    
    } 

    return { 
        filteredTreeNodes: filteredTreeNodes, 
        filteredModifiedObject: filteredModifiedObject
    };
};

 /**
  * This function will create the SOA input for deleteRelations for removing objects from Audit.
  * @param {Object} auditObject Audit object, that contains the audit team relation
  * @param {String} relation name of the audit team relation
  * @param {Array} selectedObject Array of selected objects to be removed
  * @return {Array} Returns inputData array for deleteRelations service
  */
  export let createRemoveRelationWithAuditInput = function( auditObject, relation, selectedObjects ) {
    var inputData = {};
    var soaInput = [];
    if ( auditObject && selectedObjects && selectedObjects.length > 0 ) {
        selectedObjects.forEach( function( selectedObj ) {
            inputData = {
                clientId: 'AWClient',
                primaryObject: auditObject,
                relationType: relation,
                secondaryObject: selectedObj,
                userData: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' }
            };
            soaInput.push( inputData );
        } );
    }
    return soaInput;
};

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {Object} resourceFile - File that defines the message
 * @param {String} resourceKey - The message key which should be looked-up
 * @returns {String} localizedValue - The localized message string
 */
export let getLocalizedMessage = function( resourceFile, resourceKey ) {
    var localizedValue = null;
    var localTextBundle = localeService.getLoadedText( resourceFile );
    if( localTextBundle ) {
        localizedValue = localTextBundle[ resourceKey ];
    } else {
        var asyncFun = function( localTextBundle ) {
            localizedValue = localTextBundle[ resourceKey ];
        };
        localeService.getTextPromise( resourceFile ).then( asyncFun );
    }
    return localizedValue;
};

/**
 * Unregister pbject from context object.
 *
 * @param {Object} context - Context object to get unregister from ctx
 */
export let clearRegisterContext = function( context ) {
    var currentCtx = appCtxService.getCtx( context );
    if(currentCtx) {
        appCtxService.unRegisterCtx(context);
    }
};

export default exports = {
    failureMessageConcat,
    resolveTagArrayProps,
    getDateString,
    getCreateObjectInfo,
    subscribeEventOfReport,
    populateErrorString,
    filterObjectsForDecorators,
    createRemoveRelationWithAuditInput,
    getLocalizedMessage,
    clearRegisterContext
};
