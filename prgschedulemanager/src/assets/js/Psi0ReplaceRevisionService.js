// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/Psi0ReplaceRevisionService
 */

import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import messagingSvc from 'js/messagingService';
import appCtxService from 'js/appCtxService';

let exports;

/**
 * Iterate revisions for selected PDR/DI. Remove current revision from the list
 * @param response - Response of getProperties
 * @param {selected} selected - The uid of selected object
 */
export let loadRevisions = function( response, selected ) {
    var searchResults = [];
    var selectedObj = cdm.getObject( selected );
    if ( selectedObj.props.revision_list && selectedObj.props.revision_list.dbValues.length > 1 ) {
        var revisionsUid = selectedObj.props.revision_list.dbValues;
        for ( var count = 0; count < revisionsUid.length; count++ ) {
            if ( selected !== revisionsUid[count] ) {
                searchResults.push( cdm.getObject( revisionsUid[count] ) );
            }
        }

        // Sort befre returning the ranges.
        var sortedSearchResults = _.sortBy( searchResults, [ function( revision ) { return revision.props.creation_date.dbValues[0]; } ] ).reverse();
        var outputData = {};
        outputData = {
            revisions: sortedSearchResults,
            length: searchResults.length
        };
        return outputData;
    }
};

/**
 * get input arrays of UIDs for getProperties.
 *
 * @param {mselected} ctx - The selected object.
 * @param {pselected} ctx - The parent selection.
 */
export let getPropertiesInputUIDs = function( mselected, pselected ) {
    var getPropertiesInput = [];

    for( var selCount = 0; selCount < mselected.length; selCount++ ) {
        var charGroup = {
            type: mselected[ selCount ].type,
            uid: mselected[ selCount ].uid
        };
        getPropertiesInput.push( charGroup );
    }
    var parentGroup = {
        type: pselected.type,
        uid: pselected.uid
    };
    getPropertiesInput.push( parentGroup );

    return getPropertiesInput;
};

var prepareReplaceRevisionErrorMessage = function( error, firstParam, secondParam ) {
    var message = error + '<br\>';
    message = message.replace( '{0}', firstParam );
    message = message.replace( '{1}', secondParam );
    return message;
};

var processSoaResponse = function( response, localizationKeys, ctx, inputData, noRevisions ) {
    var finalMessage = '';
    if ( response && response.ServiceData && response.ServiceData.partialErrors ) {
        for( var index in response.ServiceData.partialErrors ) {
            var errorMessages = '';
            var partialError = response.ServiceData.partialErrors[ index ];
            for( var count in partialError.errorValues ) {
                if( errorMessages === ''){
                    errorMessages = partialError.errorValues[ count ].message;
                } else {
                    errorMessages += '\n' + partialError.errorValues[ count ].message;
                }
            }
            finalMessage = prepareReplaceRevisionErrorMessage( localizationKeys.psi0ReplaceRevisionSetPropertiesErrorMsg, ctx.mselected.length );
            finalMessage += errorMessages;
        }
    } else {
        eventBus.publish( 'cdm.relatedModified', {
            relatedModified: [  ctx.xrtSummaryContextObject ]
        } );
        for ( var i = 0; i < noRevisions.length; i++ ) {
            if ( i === 0 && ctx.mselected.length !== 1 ) {
                finalMessage += prepareReplaceRevisionErrorMessage( localizationKeys.psi0NoOfSelectionsForReplaceRevisionErrorMsg, inputData.length,
                    noRevisions.length + inputData.length );
            }
            finalMessage += prepareReplaceRevisionErrorMessage( localizationKeys.psi0NoRevisionToReplaceRevisionErrorMsg, noRevisions[i].props.object_name.dbValues[0] );
        }
    }
    if ( finalMessage.length ) {
        messagingSvc.showError( finalMessage );
    }
};

/**
 * SetProperty of relation with latest revision for PDR\DI.
 *
 * @param {ctx} ctx - The ctx of the viewModel
 */
export let replaceLatestRevision = function( ctx, localizationKeys ) {
    var deliverables = [];
    var noRevisions =  [];

    var pselectedObj = cdm.getObject( ctx.pselected.uid );

    // check if Psi0PlanPrgDel property exists
    var planPrgDelProp = pselectedObj.props.Psi0PlanPrgDel;

    if( planPrgDelProp ) {
        deliverables = pselectedObj.props.Psi0PlanPrgDel.dbValues;
    }

    // check if Psi0DelInstances property exists
    var delInstancesProp = pselectedObj.props.Psi0DelInstances;

    if( delInstancesProp ) {
        deliverables = pselectedObj.props.Psi0DelInstances.dbValues;
    }

    // check if Psi0EventPrgDel property exists
    var eventPrgDelProp = pselectedObj.props.Psi0EventPrgDel;

    if( eventPrgDelProp ) {
        deliverables = pselectedObj.props.Psi0EventPrgDel.dbValues;
    }

    var setInputData = false;
    for ( var selCount = 0; selCount < ctx.mselected.length; selCount++ ) {
        var selectedObj = cdm.getObject( ctx.mselected[selCount].uid );

        if ( selectedObj.props.revision_list && selectedObj.props.revision_list.dbValues.length > 1 ) {

            var latestRevision = selectedObj.props.revision_list.dbValues[selectedObj.props.revision_list.dbValues.length - 1];
            for ( var delCount = 0; delCount < deliverables.length; delCount++ ) {
                if ( ctx.mselected[selCount].uid === deliverables[delCount] ) {
                    deliverables[delCount] = latestRevision;
                    setInputData = true;
                    break;
                }
            }


        } else {
            noRevisions.push( selectedObj );
        }
    }

    var inputData = [];
    if ( setInputData ) {
        if ( planPrgDelProp ) {
            var objectModified = {
                object: ctx.pselected,
                timestamp: '',
                vecNameVal: [ {
                    name: 'Psi0PlanPrgDel',
                    values: deliverables
                } ]
            };
            inputData.push( objectModified );
        }

        if( delInstancesProp ) {
            var objectModified = {
                object: ctx.pselected,
                timestamp: '',
                vecNameVal: [ {
                    name: 'Psi0DelInstances',
                    values: deliverables
                } ]
            };
            inputData.push( objectModified );
        }

        if( eventPrgDelProp ) {
            var objectModified = {
                object: ctx.pselected,
                timestamp: '',
                vecNameVal: [ {
                    name: 'Psi0EventPrgDel',
                    values: deliverables
                } ]
            };
            inputData.push( objectModified );
        }

        soaSvc.postUnchecked( 'Core-2010-09-DataManagement', 'setProperties', {
            info: inputData
        } ).then( function( response ) {
            processSoaResponse( response, localizationKeys, ctx, inputData, noRevisions );
        } );
    } else {
        processSoaResponse( null, localizationKeys, ctx, inputData, noRevisions );
    }
};

/**
 * SetProperty of relation with selected revision from panel.
 *
 * @param {targetObject} targetObject - The targetObject object.
 * @param {parentSelection} parentSelection - The parent selection.
 * @param {newRevision} newRevision - The newRevision selected from revision list.
 */
export let replaceRevision = function( targetObject, parentSelection, newRevision ) {
    var deliverables = [];
    var pselectedObj = cdm.getObject( parentSelection.uid );
    // check if Psi0PlanPrgDel property exists
    var planPrgDelProp = pselectedObj.props.Psi0PlanPrgDel;

    if( planPrgDelProp ) {
        deliverables = pselectedObj.props.Psi0PlanPrgDel.dbValues;
    }

    // check if Psi0DelInstances property exists
    var delInstancesProp = pselectedObj.props.Psi0DelInstances;

    if( delInstancesProp ) {
        deliverables = pselectedObj.props.Psi0DelInstances.dbValues;
    }

    // check if Psi0EventPrgDel property exists
    var eventPrgDelProp = pselectedObj.props.Psi0EventPrgDel;

    if( eventPrgDelProp ) {
        deliverables = pselectedObj.props.Psi0EventPrgDel.dbValues;
    }
    for( var count = 0; count < deliverables.length; count++ ) {
        if( targetObject.uid === deliverables[ count ] ) {
            deliverables[ count ] = newRevision.uid;
            break;
        }
    }

    var inputData = [];
    if( planPrgDelProp ) {
        var objectModified = {
            object: parentSelection,
            timestamp: '',
            vecNameVal: [ {
                name: 'Psi0PlanPrgDel',
                values: deliverables
            } ]
        };
        inputData.push( objectModified );
    }

    if( delInstancesProp ) {
        var objectModified = {
            object: parentSelection,
            timestamp: '',
            vecNameVal: [ {
                name: 'Psi0DelInstances',
                values: deliverables
            } ]
        };
        inputData.push( objectModified );
    }

    if( eventPrgDelProp ) {
        var objectModified = {
            object: parentSelection,
            timestamp: '',
            vecNameVal: [ {
                name: 'Psi0EventPrgDel',
                values: deliverables
            } ]
        };
        inputData.push( objectModified );
    }
    return inputData;
};

exports = {
    loadRevisions,
    getPropertiesInputUIDs,
    replaceLatestRevision,
    replaceRevision
};
export default exports;
