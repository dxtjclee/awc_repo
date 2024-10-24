// Copyright (c) 2022 Siemens

/**
 * Module for the Requirement Preview Page in ACE
 *
 * @module js/Arm0RequirementOLEDownloadService
 */
import cdm from 'soa/kernel/clientDataModel';
import reqACEUtils from 'js/requirementsACEUtils';
import reqUtils from 'js/requirementsUtils';
import dmSvc from 'soa/dataManagementService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

import tcVmoService from 'js/tcViewModelObjectService';
import fileMgmtSvc from 'soa/fileManagementService';
import fmsUtils from 'js/fmsUtils';

var exports = {};

/** CKEditor image reference name prefix */
var CKE_IMG_REFNAME_PREFIX = 'tccke_ref_';

/**
 * set OLE object to download
 *
 * @param {Object} data - The panel's view model object
 */
export let setOLEObjectToDownload = function( data ) {
    data.oleObjsToDownload = [];

    if( data.response && data.response.modelObjects ) {
        var modelObj = reqACEUtils.getObjectOfType( data.response.modelObjects, 'ImanFile' );

        if( modelObj !== null ) {
            data.oleObjsToDownload = [ modelObj ];
        }
    }
};

export let downloadOLEFile = function( ticket, objectsToDownload ) {
    const object = cdm.getObject( objectsToDownload[0].uid );
    fmsUtils.openFile( ticket[0], _getFileNameFromReferenceName( object ) );
};

/**
 *
 * @param {Object} imanFileObject
 */
function _getFileNameFromReferenceName( imanFileObject ) {
    let fileName = imanFileObject.props && imanFileObject.props.original_file_name ? imanFileObject.props.original_file_name.dbValues[0] : undefined;
    if( fileName && fileName.startsWith( CKE_IMG_REFNAME_PREFIX ) ) {
        fileName = fileName.substring( CKE_IMG_REFNAME_PREFIX.length );
        fileName = fileName.substring( fileName.indexOf( '_' ) + 1 );
        fileName = fileName !== '' ? fileName : undefined;
    }
    return fileName;
}

/**
 * OLE object click listener
 *
 * @param {Object} targetElement The target element which generates an event
 * @param {Object} data - The View model object
 */
export let handleOLEClick = function( targetElement, data ) {
    var oleID = targetElement.getAttribute( 'oleid' );
    var oleObjectUID = targetElement.getAttribute( 'oleObjectUID' );

    if( oleID ) {
        if( !_.includes( oleID, CKE_IMG_REFNAME_PREFIX ) ) {    // Download for newly attached OLE
            let datasets = [ { uid: oleID } ];
            //get Named reference File
            tcVmoService.getViewModelProperties( datasets, [ 'ref_list' ] ).then( function() {
                let datasetObj = cdm.getObject( oleID );
                if( datasetObj.props.ref_list && datasetObj.props.ref_list.dbValues.length > 0 ) {
                    let imanFile = datasetObj.props.ref_list.dbValues[ 0 ];
                    //Get iman file object from uid
                    let imanFileModelObject = cdm.getObject( imanFile );
                    //downloadTicket
                    let files = [ imanFileModelObject ];
                    let promise = fileMgmtSvc.getFileReadTickets( files );
                    promise.then( function( readFileTicketsResponse ) {
                        if( readFileTicketsResponse && readFileTicketsResponse.tickets && readFileTicketsResponse.tickets.length > 1 ) {
                            let ticketsArray = readFileTicketsResponse.tickets[ 1 ]; //1st element is array of iman file while 2nd element is array of tickets
                            if( ticketsArray && ticketsArray.length > 0 ) {
                                let fileName = imanFileModelObject.props && imanFileModelObject.props.original_file_name ? imanFileModelObject.props.original_file_name.dbValues[0] : undefined;
                                fmsUtils.openFile( ticketsArray[0], fileName );
                            }
                        }
                    } );
                }
            } );
        } else {
            // Get requirement element uid from requirement div
            var requirementNode = getRequirementElement( targetElement );

            if( requirementNode && requirementNode.id ) {
                var idAceElement = requirementNode.id;
                dmSvc.getProperties( [ idAceElement ], [ 'awb0UnderlyingObject' ] ).then( function() {
                    var eleObject = cdm.getObject( idAceElement );
                    var policy = {
                        types: [ {
                            name: 'Dataset',
                            properties: [ {
                                name: 'object_name'
                            },

                            {
                                name: 'ref_list',
                                modifiers: [ {
                                    name: 'withProperties',
                                    Value: 'true'
                                } ]
                            }
                            ]
                        } ]
                    };

                    var revObj = reqACEUtils.getRevisionObject( eleObject );
                    var policyId = propPolicySvc.register( policy );
                    dmSvc.getProperties( [ revObj.uid ], [ 'IMAN_specification' ] ).then( function( response ) {
                        if( policyId ) {
                            propPolicySvc.unregister( policyId );
                        }
                        // Get FullText object from IMAN_specification prop
                        var fullTextObj = undefined;
                        var rev = cdm.getObject( revObj.uid );
                        var imanSpecificationsProp = rev.props.IMAN_specification;
                        if( imanSpecificationsProp && imanSpecificationsProp.dbValues ) {
                            var imanSpecifications = imanSpecificationsProp.dbValues;
                            for( var i = 0; i < imanSpecifications.length; i++ ) {
                                var imanUid = imanSpecifications[ i ];
                                var imanObj = cdm.getObject( imanUid );
                                if( imanObj && imanObj.type === 'FullText' ) {
                                    fullTextObj = imanObj;
                                    break;
                                }
                            }
                        }

                        if( fullTextObj ) {
                            var imanID = reqUtils.getFullTextRefObj( fullTextObj, oleID );

                            if( imanID ) {
                                data.oleObjsToDownload = [ {
                                    uid: imanID,
                                    type: 'ImanFile'
                                } ];

                                eventBus.publish( 'requirementDocumentation.downloadOLEObject' );
                            } else {
                                data.oleObjectDS = [ {
                                    uid: oleObjectUID,
                                    type: 'unknownType'
                                } ];

                                eventBus.publish( 'requirementDocumentation.downloadOLEObjectFromDataSet' );
                            }
                        }
                    } );
                } );
            }
        }
    }
};

/**
 * OLE object click listener
 *
 * @param {Object} targetElement The target element which generates an event
 * @param {Object} data - The View model object
 */
export let handleOLEClickInHomeCKeditor = function( data ) {
    data.oleObjsToDownload = null;
    data.oleObjectDS = null;

    if( data.eventData && data.eventData.targetElement ) {
        var oleID = data.eventData.targetElement.getAttribute( 'oleid' );
        var oleObjectUID = data.eventData.targetElement.getAttribute( 'oleObjectUID' );

        if( oleID ) {
            var fullTextObject = data.fullTextObject;
            var imanID = reqUtils.getFullTextRefObj( fullTextObject, oleID );

            if( imanID ) {
                data.oleObjsToDownload = [ {
                    uid: imanID,
                    type: 'ImanFile'
                } ];
            } else {
                data.oleObjectDS = [ {
                    uid: oleObjectUID,
                    type: 'unknownType'
                } ];
            }
        }
    }
};

/**
 * Gets the dom requirement element closest to the 'node'
 *
 * @param {Object} node - dom element object
 * @returns {Object} Element 'undefined' if not found.
 */
function getRequirementElement( node ) {
    if( !node ) {
        return undefined;
    }
    if( isRequirmentElement( node ) ) {
        return node;
    }

    return getRequirementElement( node.parentNode );
}

/**
 * Checks whether the `node` is a requirement div or not
 *
 * @param {CKEDITOR.dom.node} node node         *
 * @returns {Boolean} element present or not
 */
function isRequirmentElement( node ) {
    return node.classList.contains( 'requirement' );
}

export default exports = {
    setOLEObjectToDownload,
    downloadOLEFile,
    handleOLEClick,
    handleOLEClickInHomeCKeditor
};
