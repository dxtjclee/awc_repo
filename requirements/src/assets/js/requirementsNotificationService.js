// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/requirementsNotificationService
 */
import cdm from 'soa/kernel/clientDataModel';
import soaService from 'soa/kernel/soaService';
import fileMgmtSvc from 'soa/fileManagementService';
import localeSvc from 'js/localeService';
import msgSvc from 'js/messagingService';
import AwStateService from 'js/awStateService';
import dmSvc from 'soa/dataManagementService';
import tcVmoService from 'js/tcViewModelObjectService';
import _ from 'lodash';
import fmsUtils from 'js/fmsUtils';

var exports = {};

/**
 * Cached messaging service
 */

/**
 * Cached locale service
 */

/**
 * event constants
 */
var FND0_CONTENT_COMPARE_COMPLETE = 'Fnd0Content_Compare_Complete';
var FND0_EXPORT_COMPLETE = 'Fnd0Export_Complete';
var FND0_WORD_IMPORT_COMPLETE = 'Fnd0Word_Import_Complete';
var ARM1_MATRIX_GENERATION_COMPLETE = 'Arm1MatrixGenerationComplete';
var ARM1_PASTE_AS_COPY_COMPLETE = 'Arm1ImportAsCopyComplete';

/**
 * Open notification message from alert popup based on different event types
 *
 * @param {Object} data - contains event object
 */
export let openLineItem = function( data ) {
    if( data.eventObj.props.eventtype_id && data.object && data.object.uid ) {
        var eventTypeId = data.eventObj.props.eventtype_id.dbValues[ 0 ];
        if( eventTypeId === FND0_CONTENT_COMPARE_COMPLETE ) {
            refreshAndDownloadDataset( data.object );
        } else if( eventTypeId === FND0_EXPORT_COMPLETE ) {
            downloadDataset( data.object );
        } else if( eventTypeId === FND0_WORD_IMPORT_COMPLETE || eventTypeId === ARM1_PASTE_AS_COPY_COMPLETE ) {
            openRelatedObjects( data.object );
        } else if( eventTypeId === ARM1_MATRIX_GENERATION_COMPLETE ) {
            openTraceabilityMatrix( data.object );
        } else {
            var toParams = {};
            toParams.uid = data.object.uid;
            redirectToShowObject( toParams );
        }
    }
};

var openTraceabilityMatrix = function( notificationObj ) {
    var imanFile = null;
    var traceabilityObject = cdm.getObject( notificationObj.props.fnd0TargetObject.dbValues[ 0 ] );

    var objectList = [ {
        uid: traceabilityObject.uid
    } ];
    var propNames = [ 'awp0AttachedMatrix' ];
    tcVmoService.getViewModelProperties( objectList, propNames ).then( function() {
        var datasetObj = cdm.getObject( traceabilityObject.props.awp0AttachedMatrix.dbValues[ 0 ] );
        objectList = [ {
            uid: datasetObj.uid
        } ];
        //get Named reference File
        tcVmoService.getViewModelProperties( objectList, [ 'ref_list' ] ).then( function() {
            if( datasetObj.props.ref_list && datasetObj.props.ref_list.dbValues.length > 0 ) {
                imanFile = datasetObj.props.ref_list.dbValues[ 0 ];
                //Get iman file object from uid
                var imanFileModelObject = cdm.getObject( imanFile );
                //downloadTicket
                var files = [ imanFileModelObject ];
                var promise = fileMgmtSvc.getFileReadTickets( files );
                promise.then( function( readFileTicketsResponse ) {
                    var originalFileName = null;
                    if( readFileTicketsResponse && readFileTicketsResponse.tickets && readFileTicketsResponse.tickets.length > 1 ) {
                        var imanFileArray = readFileTicketsResponse.tickets[ 0 ];
                        if( imanFileArray && imanFileArray.length > 0 ) {
                            var imanFileObj = cdm.getObject( imanFileArray[ 0 ].uid );
                            if( imanFileObj.props ) {
                                originalFileName = imanFileObj.props.original_file_name.uiValues[ 0 ];
                                originalFileName.replace( ' ', '_' );
                            }
                        }
                        redirectToShowTraceabilityMatrix( traceabilityObject.uid );
                    }
                } );
            }
        } );
    } );
};

/**
 * Opens the notification object on notification message click in xrt show object sublocation
 *
 * @param {String} uid - uid of notification message object
 * @param {String} params - required parameter to open the object in xrt show object
 */
var redirectToShowTraceabilityMatrix = function( uid ) {
    if( uid ) {
        var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
        var options = {};

        var toParams = {};

        toParams.uid = uid;

        options.inherit = false;
        options.reload = true;

        var url = AwStateService.instance.href( showObject, toParams, options );
        window.open( url, '_blank' );
        //AwStateService.instance.goNewTab( showObject, toParams, options );
    }
};

/**
 * Refresh and Downloads the dataset named reference for a notification object
 *
 * @param {Object} notificationObj - notification object
 */
var refreshAndDownloadDataset = function( notificationObj ) {
    var targetObject = cdm.getObject( notificationObj.props.fnd0TargetObject.dbValues[ 0 ] );
    var objects = [ targetObject ];
    soaService.postUnchecked( 'Core-2007-01-DataManagement', 'refreshObjects', {
        objects: objects
    } ).then(
        function( response ) {
            downloadDataset( notificationObj );
        } );
};

/**
 * Downloads the File attached with named reference for a notification object
 *
 * @param {Object} notificationObj - notification object
 * @param {Object} imanFile - imanFile object
 */
var downloadImanFile = function( notificationObj, imanFile ) {
    if( imanFile === null ) {
        //place Request and return
        redirectToShowObject( notificationObj.uid );
    } else {
        //Get iman file object from uid
        var imanFileModelObject = cdm.getObject( imanFile );
        //downloadTicket
        var files = [ imanFileModelObject ];
        var promise = fileMgmtSvc.getFileReadTickets( files );
        promise.then( function( readFileTicketsResponse ) {
            processReadTicketResponse( readFileTicketsResponse );
        } );
    }
};
/**
 * Downloads the dataset named reference for a notification object
 *
 * @param {Object} notificationObj - notification object
 */
var downloadDataset = function( notificationObj ) {
    var imanFile = null;
    var datasetObject = cdm.getObject( notificationObj.props.fnd0TargetObject.dbValues[ 0 ] );

    //get Named reference File
    if( datasetObject.props.ref_list && datasetObject.props.ref_list.dbValues.length > 0 ) {
        imanFile = datasetObject.props.ref_list.dbValues[ 0 ];
        downloadImanFile( notificationObj, imanFile );
    } else {
        dmSvc.getProperties( [ datasetObject.uid ], [ 'ref_list' ] ).then( function() {
            //get Named reference File
            if( datasetObject.props.ref_list && datasetObject.props.ref_list.dbValues.length > 0 ) {
                imanFile = datasetObject.props.ref_list.dbValues[ 0 ];
            }

            downloadImanFile( notificationObj, imanFile );
        } );
    }
};

/**
 * Download/open file with given fms ticket.
 *
 * @param {Object} readFileTicketsResponse - file tickets
 */
var processReadTicketResponse = function( readFileTicketsResponse ) {
    var originalFileName = null;
    if( readFileTicketsResponse && readFileTicketsResponse.tickets && readFileTicketsResponse.tickets.length > 1 ) {
        var imanFileArray = readFileTicketsResponse.tickets[ 0 ];
        if( imanFileArray && imanFileArray.length > 0 ) {
            var imanFileObj = cdm.getObject( imanFileArray[ 0 ].uid );
            if( imanFileObj.props ) {
                originalFileName = imanFileObj.props.original_file_name.uiValues[ 0 ];
                originalFileName.replace( ' ', '_' );
            }
        }
        var ticketsArray = readFileTicketsResponse.tickets[ 1 ]; //1st element is array of iman file while 2nd element is array of tickets
        if( ticketsArray && ticketsArray.length > 0 ) {
            fmsUtils.openFile( ticketsArray[ 0 ], originalFileName );
        } else {
            showNoFileMessage();
        }
    } else {
        showNoFileMessage();
    }
};

var showNoFileMessage = function() {
    localeSvc.getTextPromise().then( function( localTextBundle ) {
        msgSvc.showInfo( localTextBundle.NO_FILE_TO_DOWNLOAD_TEXT );
    } );
};
/**
 * Opens the relatedObject associated with notification object directly
 *
 * @param {Object} notificationObj - notification object
 */
var openRelatedObjects = function( notificationObj ) {
    var isError = false;
    if( notificationObj.props.fnd0Subject && notificationObj.props.fnd0Subject.dbValues.length > 0 ) {
        var subject = notificationObj.props.fnd0Subject.dbValues[ 0 ];
        isError = _.startsWith( subject, 'Import specification failed' ) || _.startsWith( subject, 'Import ReqIF failed' );
    }

    var objectUid = notificationObj.uid;
    if( !isError ) {
        if( notificationObj.props.fnd0RelatedObjects &&
            notificationObj.props.fnd0RelatedObjects.dbValues.length > 0 ) {
            objectUid = notificationObj.props.fnd0RelatedObjects.dbValues[ 0 ];
        }
    }
    redirectToShowObject( objectUid );
};

/**
 * Opens the notification object on notification message click in xrt show object sublocation
 *
 * @param {String} uid - uid of notification message object
 * @param {String} params - required parameter to open the object in xrt show object
 */
var redirectToShowObject = function( uid, params ) {
    if( uid ) {
        var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
        var options = {};

        var toParams = {};
        if( params ) {
            toParams = params;
        } else {
            toParams.uid = uid;
            toParams.page = 'Overview';
        }
        options.inherit = false;
        options.reload = true;

        AwStateService.instance.go( showObject, toParams, options );
    }
};

export default exports = {
    openLineItem
};
