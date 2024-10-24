// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epIndicationService
 */

import epLoadInputHelper from 'js/epLoadInputHelper';
import { constants as _epLoadConstants } from 'js/epLoadConstants';
import epLoadService from 'js/epLoadService';
import _ from 'lodash';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import { constants as epLoadConstants } from 'js/epLoadConstants';


/**
 * Load call for getting accountability response.
 * @param { Object } accountabilityInputObject : {
 *    'checkType' ,
 *    'currentScope',
 *    'sourceObject',
 *    'targetObject'  }
 * @returns { Object } relatedObjectsMap
 */
function loadIndication( accountabilityInputObject ) {
    propertyPolicySvc.register( {
        types: [ {
            name: epBvrConstants.IMAN_ITEM_BOP_LINE,
            properties: [ {
                name: epBvrConstants.BL_PARENT
            } ]
        } ]
    } );
    let addLoadParams;
    accountabilityInputObject.targetObject = accountabilityInputObject.targetObject ? accountabilityInputObject.targetObject : accountabilityInputObject.currentScope;
    addLoadParams = getIndicationParams( accountabilityInputObject );
    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( _epLoadConstants.ACCOUNTABILITY_CHECK, '', [ 'bl_parent' ], '', addLoadParams );
    return epLoadService.loadObject( loadTypeInputs, false ).then( response => {
        return response;
    } );
}

/**
 * Create LoadType Input for AccountibilityCheck SOA
 * @param { Object } accountabilityInputObject : {
 *    'checkType' ,
 *    'currentScope',
 *    'sourceObject',
 *    'targetObject'  }
 * @returns { Object } AddParams Object
 */
function getIndicationParams( accountabilityInputObject ) {
    return [
        epLoadInputHelper.getLoadInput( epLoadConstants.CHECK_TYPE, epLoadConstants.TYPE, accountabilityInputObject ),
        epLoadInputHelper.getLoadInput( epLoadConstants.CURRENT_SCOPE, epLoadConstants.OBJECT_UID, accountabilityInputObject ),
        epLoadInputHelper.getLoadInput( epLoadConstants.SOURCE_OBJECT, epLoadConstants.OBJECT_UID, accountabilityInputObject ),
        epLoadInputHelper.getLoadInput( epLoadConstants.TARGET_OBJECT, epLoadConstants.OBJECT_UID, accountabilityInputObject )
    ];
}

/**
 *
 * @param { Object } vmo : object onto which props will be updated
 * @param { String } imageName: which image to attach MultipleConsumptionOutOfScope / MultipleConsumptionInScope / singleConsumptionOutOfScope / singleConsumptionInScope
 * @param { String } matchType : Indication matchType '101'/ '102'/ '103'/ '104'
 */
function updateIndicationPropDataOnVmo( vmo, imageName, matchType ) {
    vmo.props.assignmentIndication.image = imageName;
    vmo.props.assignmentIndication.matchType = matchType;
    vmo.props.assignmentIndication.value = matchType;
    vmo.props.assignmentIndication.dbValue = matchType;
    vmo.props.assignmentIndication.dbValues = [ matchType ];
    vmo.props.assignmentIndication.displayValues = [ matchType ];
    vmo.props.assignmentIndication.uiValue = matchType;
    vmo.props.assignmentIndication.uiValues = [ matchType ];
}

/**
 *
 * @param {boolean} isMciTemplateDeployed ture if mci0mfgcharacteristics template deployed in DB
 * @returns {string[]} array of check type
 */
export function getCheckType( isMciTemplateDeployed ) {
    const checkType = [ 'ProductProcessBop' ];
    if( isMciTemplateDeployed ) {
        checkType.push( 'MissingInSourcePMI' );
    }
    return checkType;
}

/**
 * getTargetObject
 * @param {Boolean} isInProductBOPPage isInProductBOPPage
 * @param {boolean} processStructure processStructure
 * @param {boolean} productBOP productBOP
 * @returns {ModelObject} target object
 */
export function getTargetObject( isInProductBOPPage, processStructure, productBOP ) {
    return isInProductBOPPage ? productBOP : processStructure;
}

export default {
    getCheckType,
    loadIndication,
    getIndicationParams,
    updateIndicationPropDataOnVmo,
    getTargetObject
};
