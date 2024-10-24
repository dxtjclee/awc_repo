// Copyright (c) 2022 Siemens

/**
 * @module js/Aqc0NewWorkflowProcessCommandHandler
 */
import TypeDisplayNameService from 'js/typeDisplayName.service';
import messagingService from 'js/messagingService';
import commandPanelService from 'js/commandPanel.service';
import appCtx from 'js/appCtxService';
import adapterSvc from 'js/adapterService';
import cdm from 'soa/kernel/clientDataModel';
import notyService from 'js/NotyModule';
import _ from 'lodash';

var exports = {};

/**
 * Checks if the object is replica and returns true if it is a replica and false otherwise.
 * @param {object} object - the object to check
 * @return true if replica false otherwise
 */
var isReplica = function( object ) {
    var owningSite = object.props.owning_site;
    return  typeof owningSite !== typeof undefined && owningSite.dbValues[ 0 ] !== null && owningSite.dbValues[ 0 ] !== '';
};

/**
 * Checks if the object is checked out and returns true if it is a checked out and false otherwise.
 * @param {object} object - the object to check
 * @return true if checked out false otherwise
 */
var isCheckedOut = function( object ) {
    var propCheckedOut = object.props.checked_out_user;
    return  typeof propCheckedOut !== typeof undefined && propCheckedOut.dbValues[ 0 ] !== '';
};

/**
 * This will set the register context depends on the selections.
 * @param {objectArray} selections - the selection
 */
var setModelObject = function( selections ) {
    if( typeof selections !== typeof undefined && selections.length > 0 ) {
        var catArrayJso = [];
        adapterSvc.getAdaptedObjects( selections ).then( function( adaptedObjs ) {
            // Remove the duplicates if present in adaptedObjs list. Fix for defect # LCS-218095
            var finalAdaptedList = _.uniqWith( adaptedObjs, function( objA, objB ) {
                return objA.uid === objB.uid;
            } );
            catArrayJso.push( finalAdaptedList );
            var jso = {
                workFlowObjects: catArrayJso[ 0 ],
                IsEmbeddedComponent: appCtx.ctx.aw_hosting_enabled
            };

            appCtx.registerCtx( 'workflow_process_candidates', jso );
        } );
    } else {
        appCtx.unRegisterCtx( 'workflow_process_candidates' );
    }
};

/**
 * This will check for the case for warning message and open the panel based on the action.
 * @param {objectsArray} selections - selected object list.
 * @param {object} data - data of the context object.
 * @param {object} ctx - context object.
 */
export let populateErrorMessage = function( selections, data, ctx ) {
    var popUpMessage = '';
    var nonSubmittables = [];
    var finalMessage;
    if( !( ctx.activeToolsAndInfoCommand && ctx.activeToolsAndInfoCommand.commandId === 'Awp0NewWorkflowProcess' ) ) {
        selections.forEach( function( modelObject ) {
            var iModelObject = cdm.getObject( modelObject.uid );

            if( isReplica( iModelObject ) && !isCheckedOut( iModelObject ) ) {
                nonSubmittables.push( modelObject );
                var replicaObj = TypeDisplayNameService.instance.getDisplayName( iModelObject );
                popUpMessage = popUpMessage.concat( messagingService.applyMessageParams( data.i18n.replicaObject, [ '{{replicaObj}}' ], { replicaObj: replicaObj } ) ).concat( '</br>' );
            } else if( !isReplica( iModelObject ) && isCheckedOut( iModelObject ) ) {
                nonSubmittables.push( modelObject );
                var checkedOutObject = TypeDisplayNameService.instance.getDisplayName( iModelObject );
                popUpMessage = popUpMessage.concat( messagingService.applyMessageParams( data.i18n.checkedOutError, [ '{{checkedOutObject}}' ], { checkedOutObject: checkedOutObject } ) ).concat( '</br>' );
            }
        } );
        if( popUpMessage.length > 0 ) {
            var cannotBeSubmiitedCount = selections.length - nonSubmittables.length;
            var totalSelectedObj = selections.length;

            var message = messagingService.applyMessageParams( data.i18n.someSubmittableObjects, [ '{{cannotBeSubmiitedCount}}', '{{totalSelectedObj}}' ], {
                cannotBeSubmiitedCount: cannotBeSubmiitedCount,
                totalSelectedObj: totalSelectedObj
            } );
            finalMessage = message.concat( '</br>' ).concat( popUpMessage );
        }

        if( nonSubmittables.length === 0 ) {
            setModelObject( selections );
            commandPanelService.activateCommandPanel( 'Awp0NewWorkflowProcess', 'aw_toolsAndInfo' );
        } else {
            var buttons = [ {
                addClass: 'btn btn-notify',
                text: data.i18n.CancelText,
                onClick: function( $noty ) {
                    $noty.close();
                }
            },
            {
                addClass: 'btn btn-notify',
                text: data.i18n.Proceed,
                onClick: function( $noty ) {
                    $noty.close();
                    setModelObject( _.difference( selections, nonSubmittables ) );
                    commandPanelService.activateCommandPanel( 'Awp0NewWorkflowProcess', 'aw_toolsAndInfo' );
                }
            }
            ];
            notyService.showWarning( finalMessage, buttons );
        }
    } else {
        commandPanelService.activateCommandPanel( 'Awp0NewWorkflowProcess', 'aw_toolsAndInfo' );
    }
};

export default exports = {
    populateErrorMessage
};
