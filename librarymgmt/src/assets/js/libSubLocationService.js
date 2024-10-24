// Copyright (c) 2022 Siemens

/**
 * @module js/libSubLocationService
 */
import AwStateService from 'js/awStateService';
import cdm from 'soa/kernel/clientDataModel';

var exports = {};

export const initializeLibrarySublocation = ( data ) => {
    var filter = AwStateService.instance.params.filter;
    if( filter ) {
        var uid = filter.substring( filter.indexOf( '~' ) - 14, filter.indexOf( '~' ) );
        var mo = cdm.getObject( uid );
        if( mo && mo.props ) {
            return mo.props.object_name.dbValues[ 0 ];
        }
    }
};

export default exports = {
    initializeLibrarySublocation
};
