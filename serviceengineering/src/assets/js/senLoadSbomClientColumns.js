
// Copyright (c) 2022 Siemens

/**
 * @module js/senLoadSbomClientColumns
 */

import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';


/**
 * Method to create the client-only SBOM Columns
 *
 * @param {data} - The declarative data view model object.
 */
let loadSbomClientColumns = function( data ) {
    let cloneData = _.clone( data );
    loadAlignmentColumn( cloneData );
    loadPLFColumns( cloneData );
    return cloneData;
};

/**
 * Method to create the client-only alignment Column
 */
let loadAlignmentColumn = function( data ) {
    let displayname =  getLocalizedMessage( 'senMessages', 'mismatchOrMissingColumnTitle', null );
    data.columns.push( {
        name: 'mismatchOrMissingIndication',
        displayName: displayname,
        clientColumn:true,
        columnOrder:10,
        maxWidth: 30,
        minWidth: 30,
        pixelWidth: 30,
        propertyName:'mismatchOrMissingIndication',
        enableColumnMenu: false,
        enableSorting: false,
        enableColumnMoving: false,
        enableColumnHiding:false
    } );
};

/**
 * Method to create the client-only PLF Columns
 */
let loadPLFColumns = function( data ) {
    let displayName = '';
    let columnOrder = 1000;
    let columnNames = [ 'usagePLFColumn', 'lifeLimitedValueColumn', 'traceableValueColumn', 'serializedValueColumn', 'lotValueColumn', 'pQuantityValueColumn', 'rotableValueColumn', 'consumableValueColumn'  ];
    let map = appCtxSvc.getCtx( 'PLFDisplayNames' );

    if( map && map.has( 'assetValueColumn' ) ) {
        columnNames.push( 'assetValueColumn' );
    }

    if( map && map.has( 'skipPartValueColumn' ) ) {
        columnNames.push( 'skipPartValueColumn' );
    }

    for( let itr = 0; itr < columnNames.length; itr++ ) {
        columnOrder += 10;
        if( map ) {
            displayName = map.get( columnNames[itr] );
            if( !displayName ) {
                displayName = getLocalizedMessage( 'senMessages', columnNames[itr], null );
            }
        } else{
            displayName = getLocalizedMessage( 'senMessages', columnNames[itr], null );
        }

        let width = 90;
        let pixelWidth = 100;
        if( columnNames[itr] === 'pQuantityValueColumn' || columnNames[itr] === 'lifeLimitedValueColumn' ) { pixelWidth = 130; }
        data.columns.push( {
            name: columnNames[itr],
            displayName: displayName,
            clientColumn:true,
            columnOrder:columnOrder,
            maxWidth: 300,
            minWidth: 30,
            width: width,
            propertyName: columnNames[itr],
            enableFiltering: false,
            enableColumnResizing: true,
            enablePinning: false,
            enableColumnHiding: true,
            enableSorting: false,
            enableCellEdit: true,
            enableColumnMoving: true,
            visible: true,
            modifiable: true,
            pixelWidth: pixelWidth
        } );
    }
};


/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {Object} resourceFile - File that defines the message
 * @param {String} resourceKey - The message key which should be looked-up
 * @param {String} messageParam - The message parameter
 * @returns {String} localizedValue - The localized message string
 */
function getLocalizedMessage( resourceFile, resourceKey, messageParam ) {
    let localizedValue = '';
    let resource = resourceFile;
    let localTextBundle = localeService.getLoadedText( resource );
    if( localTextBundle ) {
        localizedValue = localTextBundle[ resourceKey ].replace( '{0}', messageParam );
    } else {
        let asyncFun = function( localTextBundle ) {
            localizedValue = localTextBundle[ resourceKey ].replace( '{0}', messageParam );
        };
        localeService.getTextPromise( resource ).then( asyncFun );
    }
    return localizedValue;
}


/**
 * Calls a SOA to get the displaynames of PLF attributes
 *
 */
const soaCallForPLFDisplayNames = async function( ) {
    let map = new Map();

    const input = {
        typeNames: [ 'PartLogisticsForm' ],
        options: {
            PropertyExclusions:[ 'LovReferences', 'NamingRules', 'RendererReferences' ],
            TypeExclusions: [ 'DirectChildTypesInfo', 'RevisionNamingRules', 'ToolInfo' ]
        }
    };

    await soaSvc.post( 'Core-2015-10-Session', 'getTypeDescriptions2', input ).then( function( response ) {
        const typeDescriptionsList = response.types[0].propertyDescriptors;

        for( let i = 0; i < typeDescriptionsList.length; i++ ) {
            if( typeDescriptionsList[i].name === 'isTraceable' ) {
                map.set( 'traceableValueColumn', typeDescriptionsList[i].displayName );
            }else if( typeDescriptionsList[i].name === 'isSerialized' ) {
                map.set( 'serializedValueColumn', typeDescriptionsList[i].displayName );
            }else if( typeDescriptionsList[i].name === 'isLot' ) {
                map.set( 'lotValueColumn', typeDescriptionsList[i].displayName );
            }else if( typeDescriptionsList[i].name === 'preserveQuantity' ) {
                map.set( 'pQuantityValueColumn', typeDescriptionsList[i].displayName );
            }else if( typeDescriptionsList[i].name === 'isRotable' ) {
                map.set( 'rotableValueColumn', typeDescriptionsList[i].displayName );
            }else if( typeDescriptionsList[i].name === 'isConsumable' ) {
                map.set( 'consumableValueColumn', typeDescriptionsList[i].displayName );
            }else if( typeDescriptionsList[i].name === 'lifeLimited' ) {
                map.set( 'lifeLimitedValueColumn', typeDescriptionsList[i].displayName );
            }else if( typeDescriptionsList[i].name === 'sse0isAsset' ) {
                map.set( 'assetValueColumn', typeDescriptionsList[i].displayName );
            }else if( typeDescriptionsList[i].name === 'smr0skipPart' ) {
                map.set( 'skipPartValueColumn', typeDescriptionsList[i].displayName );
            }
        }
        appCtxSvc.updateCtx( 'PLFDisplayNames', map );
    } );
};

export default {
    soaCallForPLFDisplayNames,
    loadSbomClientColumns
};
