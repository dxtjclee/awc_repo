// Copyright (c) 2021 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Eda0EdmViewerService
 */
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import propSvc from 'soa/kernel/propertyPolicyService';
import AwSceService from 'js/awSceService';
import msgSvc from 'js/messagingService';
import prefSvc from 'soa/preferenceService';
import localeSvc from 'js/localeService';

var exports = {};

var serverUrl = null;

var projPath = null;
var designInfo = null;
var keyValueDataForChart = [];

export let openInViewerTab = function( data ) {
    prefSvc.getStringValue( 'EDA_EDMHosting.URL' ).then( function( result ) {
        var resource = 'EdaMessages';
        var localTextBundle = localeSvc.getLoadedText( resource );
        var localizedMsg = localTextBundle.preferenceNotConfigured;
        if( result !== '' && result !== null ) {
            serverUrl = result;
        } else {
            msgSvc.showError( localizedMsg );
        }
    } );

    var inputData = {
        primaryObjects: [ {
            uid: appCtxSvc.ctx.selected.uid,
            type: appCtxSvc.ctx.selected.type
        } ],
        pref: {
            expItemRev: false,
            returnRelations: true,
            info: [ {
                relationTypeName: 'Eda0HasDesignInfo',
                otherSideObjectTypes: [ 'Eda0MentorDesignInfo' ]
            } ]
        }
    };
    var policyId = propSvc.register( {
        types: [ {
            name: 'Eda0MentorDesignInfo',
            properties: [ {
                name: 'eda0SchematicProjectUid'
            },
            {
                name: 'eda0PcbProjectUid'
            }
            ]
        } ]
    } );

    soaSvc.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', inputData ).then( function( result ) {
        if( result.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ] ) {
            designInfo = result.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ].otherSideObject;
        }
        serverUrl = validateEdmHostingUrl( serverUrl );
        if( designInfo !== null ) {
            var projPathPcb = null;
            var projPathSch = null;
            if( designInfo.props.eda0PcbProjectUid !== null ) {
                projPathPcb = designInfo.props.eda0PcbProjectUid.dbValues[ 0 ];
            }
            if( designInfo.props.eda0SchematicProjectUid !== null ) {
                projPathSch = designInfo.props.eda0SchematicProjectUid.dbValues[ 0 ];
            }
            if( serverUrl !== null && serverUrl !== '' ) {
                //If PCB is present, give preference to PCB over Schematic
                if( projPathPcb !== null && projPathPcb !== '' ) {
                    projPath = serverUrl + '/xcc/?path=' + projPathPcb + '&embedded';
                } else {
                    projPath = serverUrl + '/xcc/?path=' + projPathSch + '&embedded';
                }
                propSvc.unregister( policyId );
                if( projPath !== '' && projPath !== null ) {
                    data.projPath = projPath;
                    data.dispatch( { path: 'data.projPath', value: data.projPath } );
                }
            }
        }
    } );
};

/**
  * Checks and appends http to the URL if required.
  * @param {String} serverUrl server url.
  * @returns {String} corrected server url.
  */
function validateEdmHostingUrl( serverUrl ) {
    //Check and append the http to the EDM hosting URL if not present.
    if( serverUrl !== null && serverUrl !== '' ) {
        if( !serverUrl.includes( 'http://' ) ) {
            serverUrl = 'http://' + serverUrl;
        }
    }
    return serverUrl;
}

/**
  * Creates Pie Chart for placement progress
  *
  * @param {String} data the view model data
  */

export let createPlacementPieChart = function( data, subPanelContext ) {
    var arrayOfSeriesDataForChart = [];

    var percentPlacedPropValue = subPanelContext.xrtState.xrtVMO.props[ 'GRM(Eda0HasDesignInfo,Eda0DesignInfo).eda0PercentPlaced' ].value;

    var labels = [ '% ' + data.i18n.placed, '% ' + data.i18n.unplaced ];
    var percent = null;
    keyValueDataForChart = [];
    if( percentPlacedPropValue !== null && percentPlacedPropValue !== '' && percentPlacedPropValue !== undefined && percentPlacedPropValue.includes( '%' ) ) {
        var index = percentPlacedPropValue.indexOf( '%' );
        percent = percentPlacedPropValue.substr( 0, index );
    }

    var percentPlaced = parseFloat( Number( percent ).toFixed( 2 ) );
    var percentUnplaced = parseFloat( Number( 100 - percentPlaced ).toFixed( 2 ) );

    var arr = [ percentPlaced, percentUnplaced ];

    for( var i = 0; i < arr.length; i++ ) {
        keyValueDataForChart.push( {
            label: labels[ i ],
            value: arr[ i ],
            name: labels[ i ],
            y: arr[ i ]
        } );
    }

    arrayOfSeriesDataForChart.push( {
        seriesName: 'Placement',
        keyValueDataForChart: keyValueDataForChart
    } );
    return arrayOfSeriesDataForChart;
};

/**
  * Creates Pie Chart for routing progress
  *
  * @param {String} data the view model data
  */
export let createRoutingPieChart = function( data, subPanelContext ) {
    var arrayOfSeriesDataForChart = [];

    var percentRoutedPropValue = subPanelContext.xrtState.xrtVMO.props[ 'GRM(Eda0HasDesignInfo,Eda0DesignInfo).eda0PercentRouted' ].value;

    var labels = [ '% ' + data.i18n.routed, '% ' + data.i18n.unrouted ];
    var percent = null;
    keyValueDataForChart = [];
    if( percentRoutedPropValue !== null && percentRoutedPropValue !== '' && percentRoutedPropValue !== undefined && percentRoutedPropValue.includes( '%' ) ) {
        var index = percentRoutedPropValue.indexOf( '%' );
        percent = percentRoutedPropValue.substr( 0, index );
    }
    var percentRouted = parseFloat( Number( percent ).toFixed( 2 ) );
    var percentUnrouted = parseFloat( Number( 100 - percentRouted ).toFixed( 2 ) );

    var arr = [ percentRouted, percentUnrouted ];

    for( var i = 0; i < arr.length; i++ ) {
        keyValueDataForChart.push( {
            label: labels[ i ],
            value: arr[ i ],
            name: labels[ i ],
            y: arr[ i ]
        } );
    }

    arrayOfSeriesDataForChart.push( {
        seriesName: 'Routing',
        keyValueDataForChart: keyValueDataForChart
    } );
    return arrayOfSeriesDataForChart;
};

export default exports = {
    openInViewerTab,
    createPlacementPieChart,
    createRoutingPieChart

};

