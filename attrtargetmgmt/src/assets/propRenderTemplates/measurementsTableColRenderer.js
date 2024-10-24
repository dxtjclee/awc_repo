// Copyright (c) 2022 Siemens

/**
 * native construct to hold the server version information related to the AW server release.
 *
 * @module propRenderTemplates/measurementsTableColRenderer
 */
import cdm from 'soa/kernel/clientDataModel';
import fmsUtils from 'js/fmsUtils';
import fileMgmtSvc from 'soa/fileManagementService';
import eventBus from 'js/eventBus';
import dmSvc from 'soa/dataManagementService';
import { svgString as cmdRemove } from 'image/cmdRemove24.svg';

var exports = {};

export let attachFileColRenderer = function( vmo, containerElem ) {
    var textDiv = document.createElement( 'div' );
    textDiv.className = 'aw-splm-tableCellText';
    var prop = vmo.props[ 'GRMREL(Att0HasMeasurementFile,Dataset).secondary_object' ];
    if( prop && prop.displayValues && prop.displayValues.length > 0 ) {
        textDiv.innerText = prop.displayValues[ 0 ];
        textDiv.setAttribute( 'style', 'cursor:pointer;color:#197FA2;' );
        textDiv.addEventListener( 'click', function() {
            downloadDataset( prop.dbValue );
        } );
        var cellImg = document.createElement( 'div' );
        cellImg.className = 'aw-visual-indicator aw-commands-command aw-aria-border';
        cellImg.tabIndex = 0;
        cellImg.style = 'width: 24px; height: 12px';
        cellImg.innerHTML = cmdRemove;
        cellImg.addEventListener( 'click', function() {
            var datasetObject = cdm.getObject( prop.dbValue );
            eventBus.publish( 'Att1MeasurementsView.updateCtxDeleteAttachedFile', { datasetObject: datasetObject,targetEle : cellImg });
        } );
        containerElem.appendChild( textDiv );
        containerElem.appendChild( cellImg );
    }
};

/**
  * Downloads the dataset named reference for a notification object
  *
  * @param {String} uid - uid of the object
  */
var downloadDataset = function( uid ) {
    var imanFile = null;
    var datasetObject = cdm.getObject( uid );

    //get Named reference File
    if( datasetObject.props.ref_list && datasetObject.props.ref_list.dbValues.length > 0 ) {
        imanFile = datasetObject.props.ref_list.dbValues[ 0 ];
        downloadImanFile( imanFile );
    } else {
        dmSvc.getProperties( [ datasetObject.uid ], [ 'ref_list' ] ).then( function() {
            //get Named reference File
            if( datasetObject.props.ref_list && datasetObject.props.ref_list.dbValues.length > 0 ) {
                imanFile = datasetObject.props.ref_list.dbValues[ 0 ];
            }
            downloadImanFile( imanFile );
        } );
    }
};

/**
  * Downloads the File attached with named reference for a notification object
  * @param {Object} imanFile - imanFile object
  */
var downloadImanFile = function( imanFile ) {
    if( imanFile && imanFile !== null ) {
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
        }
    }
};

export default exports = {
    attachFileColRenderer
};

