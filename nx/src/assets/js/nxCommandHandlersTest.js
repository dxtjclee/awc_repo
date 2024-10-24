/* eslint-disable no-await-in-loop */
// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/nxCommandHandlersTest
 */
import _ from 'lodash';
import notyService from 'js/NotyModule';
import hostUtils from 'js/hosting/hostUtils';
import cfgSvc from 'js/configurationService';
import cmdHandlers from 'js/nxCommandHandlers';

import 'config/testdatamaster';
import 'config/testDataOpenInNX';

var exports = {};

var masterItems = cfgSvc.getCfgCached( 'testDataOpenInNX' );

const correctPayloadSent = 'The correct payload was sent to the host';
const incorrectPayloadSent = 'The incorrect payload was sent to the host';

export let nxCheckinCheckoutCommandDelegate = function( sourceObjects, operation ) {
    // TODO: This payload creation must be removed once Hosting module is converted to native.
    var data = {
        DBId: '',
        ObjId: sourceObjects[ 0 ].uid,
        ObjType: 'UGMASTER'
    };
    var encodedData = hostUtils.encodeEmbeddedJson( JSON.stringify( data ) );
    var payload = {
        Version: '_2016_03',
        Operation: operation,
        Targets: [ {
            Data: encodedData,
            Type: 'UID'
        } ]
    };
};

//to add more objects to test, add an object to testDataOpenInNX.json
//Key should be the objects object string, should also have a type
export let openInNxHandler = async function( sourceObjects ) {
    var isCorrect = true;
    //for loop for mulitselection
    for( var i = 0; i < sourceObjects.length; i++ ) {
        var item = sourceObjects[ i ];

        //First check that the UID and type exist
        isCorrect = checkUIDAndTypeForNull( item.uid, item.type );

        //do some processing on the object
        var processedItem = cmdHandlers.openInNXInitialChecks( [ item ] ).find( element => element.uid === item.uid );

        //do more intensive checking on processed item including checking if there is a master item
        isCorrect = checkItem( processedItem );

        var isPacked = false;
        //Check if the current selected object is packed
        if( processedItem.props && processedItem.props.awb0IsPacked && processedItem.props.awb0IsPacked.dbValues &&
            _.isEqual( processedItem.props.awb0IsPacked.dbValues[ 0 ], '1' ) ) {
            isPacked = true;
        }

        // Call openPackedInNx only if any of the selected objects is packed
        if( isPacked ) {
            var getCloneStableIDsWithPackedOccurrencesResult = cmdHandlers.openInNXCheckPacked( [ processedItem ] );
            if( getCloneStableIDsWithPackedOccurrencesResult ) {
                //packed instances should return more than 1 object
                await cmdHandlers.openPackedInNX( getCloneStableIDsWithPackedOccurrencesResult ).then( function( responseData ) {
                    if( responseData.length < 2 ) {
                        isCorrect = false;
                        console.error( 'Packed instance has less than 2 instances' );
                    } else {
                        //check there are no duplicate uids on packed objects
                        //If one uid is the same then they all are
                        if( responseData[ 0 ].uid === responseData[ 1 ].uid ) {
                            isCorrect = false;
                            console.error( 'Packed instances have multiple duplicate uids' );
                        }

                        //Check that the uid and type on each packed object exists
                        for( var y = 0; y < responseData.length; y++ ) {
                            isCorrect = checkUIDAndTypeForNull( responseData[ y ].uid, responseData[ y ].type );

                            if( !isCorrect ) { break; }
                        }
                    }
                } );
            }
        }

        if( !isCorrect ) {
            break;
        }
    }
    if( isCorrect === true ) {
        notyService.showInfo( correctPayloadSent );
    } else {
        notyService.showInfo( incorrectPayloadSent );
    }
};

function checkUIDAndTypeForNull( uid, type ) {
    var isValid = !( hostUtils.isNil( uid ) || hostUtils.isNil( type ) );

    if( !isValid ) { console.log( 'uid or type is not valid' ); }

    return isValid;
}

function checkObjectStringForNull( objectString ) {
    var isValid = !( hostUtils.isNil( objectString ) || hostUtils.isNil( objectString.dbValues[ 0 ] ) );

    if( !isValid ) { console.log( 'Object string is not valid' ); }

    return isValid;
}

//checks an item for discreptencies
//if the item is in our master data then check it with the master data
//if not then check that it's UID, type and object string aren't null
function checkItem( item ) {
    var isCorrect = false;
    var masterItem = null;
    isCorrect = checkUIDAndTypeForNull( item.uid, item.type );
    isCorrect = checkObjectStringForNull( item.props.object_string );

    if( isCorrect ) {
        masterItem = masterItems[ item.props.object_string.dbValues[ 0 ] ];
    }

    if( !hostUtils.isNil( masterItem ) ) {
        isCorrect = compareItemToMaster( item, masterItem );
    } else {
        console.log( 'Master item was null, for more thorough checking add a master item' );
    }

    return isCorrect;
}

function compareItemToMaster( item, master ) {
    var isCorrect = master.type === item.type;

    if( !isCorrect ) {
        console.error( 'Item does not have the same type as the item in the json' );
    }

    return isCorrect;
}

export let addComponentHandler = function( sourceObjects ) {
    var isCorrect = false;
    for( var i = 0; i < sourceObjects.length; i++ ) {
        for( var i = 0; i < sourceObjects.length; i++ ) {
            isCorrect = checkItem( sourceObjects[ i ] );
        }
        if( !isCorrect ) { break; }
    }
    if( isCorrect ) {
        notyService.showInfo( correctPayloadSent );
    } else {
        notyService.showInfo( incorrectPayloadSent );
    }
};

export let openWithContextHandler = function( sourceObjects, context ) {
    var isCorrect = false;
    for( var i = 0; i < sourceObjects.length; i++ ) {
        isCorrect = checkItem( sourceObjects[ i ] );
        if( !isCorrect ) { break; }
    }
    if( isCorrect ) {
        notyService.showInfo( correctPayloadSent );
    } else {
        notyService.showInfo( incorrectPayloadSent );
    }
};

export default exports = {
    nxCheckinCheckoutCommandDelegate,
    openInNxHandler,
    addComponentHandler,
    openWithContextHandler
};
