// Copyright (c) 2022 Siemens

/**
 * @module js/prm1AddViewToGatewayService
 */
import cdm from 'soa/kernel/clientDataModel';
import AwStateService from 'js/awStateService';
import prm1CompareService from 'js/prm1ParameterViewService';
import _ from 'lodash';

var exports = {};

/**
 *
 * @param {object} ctx context object
 * @param {object} param object uid
 * @param {string} prop property name
 * @returns {string} dispName
 */
function makeTileDisplayName( data, param, prop ) {
    var dispName = data.i18n.gatewayTileTitle + ':';
    var separator = prm1CompareService.getSeparator();
    let params = AwStateService.instance.params;
    var tbtElem = params.sel_uids.split( separator );

    _.forEach( tbtElem, function( uid ) {
        var obj = cdm.getObject( uid );
        if( obj && obj.props && obj.props.object_name ) {
            dispName += obj.props.object_name.uiValues[ '0' ] + '; ';
        } else if( obj.props.object_string ) {
            dispName += obj.props.object_string.uiValues[ '0' ] + '; ';
        }
    } );
    var uids = typeof params[ param ] === 'string' ? params[ param ].split( separator ) : [];
    _.forEach( uids, function( uid ) {
        var obj = cdm.getObject( uid );
        if( obj && obj.props && obj.props[ prop ] ) {
            dispName += obj.props[ prop ].uiValues[ 0 ] + '; ';
        }
    } );
    return dispName;
}

/**
 * This method is used to created input for pinCompareParameterView SOA
 * @param {*} data data object
 * @param {*} ctx  context object
 */
export let getPinParameterCompareInput = function( data, ctx ) {
    var tileTemplateId = 'Prm1ParameterCompareTemplate';
    var dispNameAddlObjsProp = 'object_name';
    var dispNameAddlObjsParam = 'comp_uids';

    var dispName = makeTileDisplayName( data, dispNameAddlObjsParam, dispNameAddlObjsProp );
    var paramIdx = window.location.hash ? window.location.hash.indexOf( '?' ) : -1;
    if ( paramIdx < 0 ) {
        return;
    }
    var params = window.location.hash.substring( paramIdx );

    return [ {
        tileName:dispName,
        templateId:tileTemplateId,
        actionParams:params
    } ];
};

export default exports = {
    getPinParameterCompareInput
};
