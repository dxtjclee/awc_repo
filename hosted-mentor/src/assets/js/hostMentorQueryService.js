// Copyright (c) 2022 Siemens

/**
 * Mentor Service to assist in creating and sending {HostQueryMessage} objects.
 *
 * @module js/hostMentorQueryService
 * @namespace hostMentorQueryService
 */
import { loadDependentModule } from 'js/moduleLoader';
import hostInteropSvc from 'js/hosting/hostInteropService';
import hostQueryFactorySvc from 'js/hosting/hostQueryFactoryService';
import hostQuerySvc from 'js/hosting/sol/services/hostQuery_2015_10';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import logger from 'js/logger';
import hostServices from 'js/hosting/hostConst_Services';
import cfgSvc from 'js/configurationService';
import 'config/hosting';

/**
 * Register service.
 *
 * @member hostMentorQueryService
 *
 * @param {hostInteropService} hostInteropSvc - Service to use.
 * @param {hostQueryFactoryService} hostQueryFactorySvc - Service to use.
 * @param {hostQuery_2015_10} hostQuerySvc - Service to use.
 * @param {soa_kernel_soaService} soaSvc - Service to use.
 *
 * @returns {hostMentorQueryService} Reference to service's API object.
 */

/**
 * Map of messageId to the {HostQueryHandler} regististed to handle it when the 'host' responds from an async request.
 */
var _messageIdToResponseHandlerMap = {};

/**
 * Cache of hostQuery 'handlers'.
 */
var _map_query_to_handler = {};

var _input_message = '';

/**
 * Query id for 'IsMentorQueryHandlerAvailable' query.
 * <P>
 * This query can go either from Host -> Client or Client -> Host and asks the other side if it has a handler for a
 * given query id.
 * <P>
 * The input is a string with key 'QueryId' and value of the query id to check.
 * <P>
 * The return value is a boolean with a key of 'HasQueryHandler'
 */
var IS_MENTOR_QUERY_HANLDER_AVAILABLE_ID = 'com.siemens.splm.client.Mentor.IsMentorQueryHandlerAvailable';

var _soaSvc = soaSvc;

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// IsMentorQuerySupportedQueryHandler
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * This {HostQueryHandler} allows simple check of support for a given quiey ID by the 'host'.
 *
 * @constructor
 * @memberof hostMentorQueryService
 *
 * @extends {hostQueryFactoryService.HostQueryHandler}
 */
var IsMentorQuerySupportedQueryHandler = function() {
    hostQueryFactorySvc.getHandler().call( this );
};

IsMentorQuerySupportedQueryHandler.prototype = hostQueryFactorySvc.extendHandler();

/**
 * TC_config_rule_name the default config rule that will be used when opening/printing Imprecise BOMView or BOMViewRevisions.
 * If this rule does not exist, the system will default to "Latest Working".
 */
function getDefaultRevRule() {
    return _soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
        preferenceNames: [ 'TC_config_rule_name' ],
        includePreferenceDescriptions: false
    }, {} ).then(
        function( result ) {
            return result;
        } );
}

/**
 * Method is used to get Item and its revision object dependending on TC_config_rule_name rule.
 * ItemId is attributes used for seach.
 */
function getTcUIDfromItemSOA( serchAttribute, revisionRule ) {
    var serviceName = 'Core-2008-06-DataManagement';
    var method = 'getItemAndRelatedObjects';
    var info = {};
    info.infos = [ {
        clientId: 'gIRO_EDAClient',
        itemInfo: {
            clientId: 'gIRO_Item_EDAClient',
            useIdFirst: true,
            uid: '',
            ids: [ {
                name: 'fnd0PartIdentifier',
                value: serchAttribute
            } ]
        },
        revInfo: {
            clientId: 'gIRO_Rev_EDAClient',
            processing: 'Rule',
            useIdFirst: false,
            uid: '',
            id: '',
            nRevs: 1,
            revisionRule: revisionRule
        },
        datasetInfo: {
            clientId: 'gIRO_ds_EDAClient',
            uid: '',
            filter: {
                useNameFirst: false,
                processing: 'None',
                nrFilters: [],
                name: '',
                relationFilters: [ {
                    relationTypeName: '',
                    datasetTypeName: 'Text'
                } ]
            },
            namedRefs: [ {
                namedReference: 'UGPART',
                ticket: true
            } ]
        },
        bvrTypeNames: []
    } ];
    return _soaSvc.postUnchecked( serviceName, method, info ).then(
        function( response ) {
            return response;
        } );
}

/**
 * Handle an incomming query from the 'host'.
 *
 * @memberof hostQueryService.IsMentorQuerySupportedQueryHandler
 *
 * @param {HostQueryMessage} inputMessage - The input message from the 'host'.
 *
 * @return {HostQueryMessage} The {HostQueryMessage} to send back to 'host' containing any details resulting
 * from handling the query.
 */
IsMentorQuerySupportedQueryHandler.prototype.handleQuery = function( inputMessage ) {
    var dataObjects = inputMessage.queryData;

    if( !_.isEmpty( dataObjects ) ) {
        var queryIdDataObject = dataObjects[ 0 ];
        var queryItemIdDataObject = dataObjects[ 1 ];
        var queryId = queryIdDataObject.getField( 'QueryId' );
        var queryItemId = queryItemIdDataObject.getField( 'ItemId' );

        // cache input message
        _input_message = inputMessage;
        if( queryId ) {
            var isHandled = hostInteropSvc.isQueryHandled( queryId );
            if( isHandled ) {
                var revisionRule = 'Latest Working';
                getDefaultRevRule().then( function( responsePref ) {
                    if( responsePref && responsePref.response && responsePref.response[ 0 ] && responsePref.response[ 0 ].values && responsePref.response[ 0 ].values.values[ 0 ] ) {
                        revisionRule = responsePref.response[ 0 ].values.values[ 0 ];
                    }

                    getTcUIDfromItemSOA( queryItemId, revisionRule ).then( function( responseSOA ) {
                        var responseMessages = [];
                        var asyncResponse = [];

                        // Check if input response is not null and contains partial errors then only
                        // create the error object
                        if( responseSOA && responseSOA.ServiceData &&
                            ( responseSOA.ServiceData.partialErrors || responseSOA.ServiceData.PartialErrors ) ) {
                            var err = null;
                            var message = '';
                            err = _soaSvc.createError( responseSOA );
                            // Check if error object is not null and has partial errors then iterate for each error code
                            // and filter out the errors which we don't want to display to user
                            if( err && err.cause && err.cause.ServiceData && err.cause.ServiceData.partialErrors ) {
                                _.forEach( err.cause.ServiceData.partialErrors, function( partErr ) {
                                    if( partErr.errorValues ) {
                                        _.forEach( partErr.errorValues, function( errVal ) {
                                            if( errVal.code ) {
                                                if( message && message.length > 0 ) {
                                                    message += '\n' + errVal.message;
                                                } else {
                                                    message += errVal.message + '\n';
                                                }
                                            }
                                        } );
                                    }
                                } );
                            }
                            var asyncResponseData = hostQueryFactorySvc.createEditableData();
                            asyncResponseData.setData( 'Status', 'Failed' );
                            asyncResponseData.setData( 'Error', message );
                            asyncResponse.push( asyncResponseData );
                        } else {
                            if( responseSOA.output.length > 0 ) {
                                _.forEach( responseSOA.output, function( entry ) {
                                    var asyncResponseData = hostQueryFactorySvc.createEditableData();

                                    var reItem = entry.item;
                                    var reItemRev = entry.itemRevOutput[ 0 ].itemRevision;

                                    if( reItem && reItemRev ) {
                                        asyncResponseData.setData( 'Status', 'Success' );
                                        asyncResponseData.setData( 'Item_TcType', reItem.type );
                                        asyncResponseData.setData( 'Item_UID', reItem.uid );
                                        asyncResponseData.setData( 'ItemRevision_TcType', reItemRev.type );
                                        asyncResponseData.setData( 'ItemRevision_UID', reItemRev.uid );
                                        asyncResponse.push( asyncResponseData );
                                    }
                                } );
                            }
                        }
                        var reply = hostQueryFactorySvc.createResponseMessage( _input_message, asyncResponse );
                        responseMessages.push( reply );
                        sendAsyncQueryToMentorHost( responseMessages );
                    } );
                } );
            }
        }
    }
    return null;
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// Public Functions
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

var exports = {};

/**
 * Return a new instance of this class.
 *
 * @memberof hostMentorQueryService
 *
 * @returns {HostQueryData} New initialized instance of this class.
 */
export let createIsMentorQuerySupportedQueryHandler = function() {
    return new IsMentorQuerySupportedQueryHandler();
};

/**
 * Send an async query to the 'host'.
 *
 * @memberof hostMentorQueryService
 *
 * @param {HostQueryMessage} query -
 * @param {HostQueryAsyncResponseHandler} responseHandler -
 */
function sendAsyncQueryToMentorHost( query ) {
    if( canQueryMentorHost() ) {
        hostQuerySvc.createHostQueryProxy().fireHostEvent( query );
    }
}

/**
 * Is it possible to send queries to the 'host'.
 *
 * @memberof hostMentorQueryService
 *
 * @return {Boolean} TRUE if the 'host' supports receiving {HostQueryMessage} calls.
 */
function canQueryMentorHost() {
    return hostInteropSvc.isHostServiceAvailable(
        hostServices.HS_INTEROPQUERY_SVC,
        hostServices.VERSION_2015_10
    );
}

/**
 * Check if the 'host' has a handler for the given query.
 *
 * @memberof hostMentorQueryService
 *
 * @param {String} queryId - The ID of query to check.
 *
 * @return {Boolean} TRUE if the 'host' has a handler for the given query ID.
 */
export let canHostHandleQuery = function( queryId ) {
    var hostHasHandler = false;

    // Verify the host supports queries
    if( canQueryMentorHost() ) {
        // Query the host to check if it supports the passed in query id
        var data = hostQueryFactorySvc.createEditableData();

        data.setData( 'QueryId', queryId );

        var dataObjects = [];

        dataObjects.push( data );

        var queryMessage = hostQueryFactorySvc.createMessageWithID( IS_MENTOR_QUERY_HANLDER_AVAILABLE_ID, dataObjects );

        // Send query to host
        var response = exports.sendQueryToHost( queryMessage );

        if( !_.isEmpty( response ) ) {
            // Check the response data to see if the query is supported.
            var responseData = response.getData();

            if( !_.isEmpty( responseData ) ) {
                var dataObject = responseData[ 0 ];

                if( dataObject.hasField( 'HasQueryHandler' ) ) {
                    hostHasHandler = dataObject.getField( 'HasQueryHandler' );
                }
            }
        }
    }

    return hostHasHandler;
};

/**
 * Handle an async query response.
 *
 * @memberof hostMentorQueryService
 *
 * @param {HostQueryMessage} queryResponse - The query response to handle.
 */
export let handleQueryResponse = function( queryResponse ) {
    var msgId = queryResponse.getMessageId();

    var responseHandler = _.get( _messageIdToResponseHandlerMap, msgId, null );

    if( responseHandler ) {
        responseHandler.handleQueryResponse( queryResponse );

        // Remove the handler after the response is received
        delete _messageIdToResponseHandlerMap[ msgId ];
    } else {
        logger.warn( 'No host query handler found for query id: ' + queryResponse.getQueryId() + ' with message id: ' + msgId );
    }
};

// ---------------------------------------------------------------------------------

/**
 * Register any client-side (CS) services (or other resources) contributed by this module.
 *
 * @memberof hostMentorQueryService
 */
export let registerHostingModule = function() {
    //
};

export default exports = {
    createIsMentorQuerySupportedQueryHandler,
    canHostHandleQuery,
    handleQueryResponse,
    registerHostingModule
};
