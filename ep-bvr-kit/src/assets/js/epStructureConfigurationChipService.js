// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for ep chip configuration
 *
 * @module js/epStructureConfigurationChipService
 */
import localeService from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';

const resource = localeService.getLoadedText( 'structureConfigurationMessages' );
/**
 *
 * @param {Array} configData configData
 * @returns{Object} Work package related information
 */
function getStructuresConfigData( configData, defaultClosureRule ) {
    let contestUidGroupUidMAp = {};
    let groupUidList = [];
    const structuresConfigData = [];
    let workPackageContentTypes = getworkPackageContentTypesFromPref( );
    for( const structure of configData ) {
        if( structure.pci !== undefined && workPackageContentTypes.indexOf( structure.structureType ) > -1 ) {
            let pciObj = cdm.getObjects( [ structure.pci.uid ] );
            let structuresConfigDataList = {};
            let epTaskPageContext = appCtxSvc.getCtx( 'epTaskPageContext' );
            if( structure.structureName in epTaskPageContext ) {
                let matchObjProps = epTaskPageContext[structure.structureName].props;
                structuresConfigDataList = {
                    pciUid: structure.pci.uid,
                    chipLabel:structure.chipLabel,
                    revision: {
                        dispValue: matchObjProps.awb0CurrentRevRule.uiValues[0],
                        splitter: true,
                        labelPosition: 'NO_PROPERTY_LABEL'
                    }
                };
                if(  matchObjProps.awb0EffDate.uiValues[ 0 ] !== '' ) {
                    structuresConfigDataList.date = {
                        dispValue: matchObjProps.awb0EffDate.uiValues[ 0 ],
                        splitter: true,
                        labelPosition: 'NO_PROPERTY_LABEL'
                    };
                }
                if(  matchObjProps.awb0EffUnitNo.uiValues[ 0 ] !== '' ) {
                    let endItem =  matchObjProps.awb0EffEndItem.uiValues[ 0 ] !== '' ?  matchObjProps.awb0EffEndItem.uiValues[ 0 ] : structure.context.props.object_string.uiValues[0];
                    structuresConfigDataList.units = {
                        dispValue:  matchObjProps.awb0EffUnitNo.uiValues[ 0 ] + ' (' + endItem + ')',
                        unit:resource.awb0EffUnitNoLabel + ': ' +  matchObjProps.awb0EffUnitNo.uiValues[ 0 ],
                        endItem:resource.endItem + ': ' + endItem,
                        splitter: true,
                        labelPosition: 'NO_PROPERTY_LABEL'
                    };
                }
                if( matchObjProps.awb0VariantRules !== undefined  && matchObjProps.awb0VariantRules.uiValues.length > 0 ) {
                    structuresConfigDataList.variant = {
                        dispValue : matchObjProps.awb0VariantRules.uiValues[ 0 ] + ' (' + matchObjProps.awb0Product.uiValues[ 0 ] + ')',
                        splitter: true,
                        variant: matchObjProps.awb0VariantRules.uiValues[ 0 ],
                        endItem:matchObjProps.awb0EffEndItem.uiValues[ 0 ],
                        labelPosition: 'NO_PROPERTY_LABEL'
                    };
                }
                if ( structure.confligFlags.show_unconfigured_effectivity[0] === 'true' ) {
                    structuresConfigDataList.excludedByEffectivityFlag = true;
                }
                if ( structure.confligFlags.show_unconfigured_variants[0] === 'true' ) {
                    structuresConfigDataList.excludedByVariantFlag = true;
                }
                if ( structure.confligFlags.show_unconfigured_assignment !== undefined && structure.confligFlags.show_unconfigured_assignment[0] === 'true' ) {
                    structuresConfigDataList.excludedByAssignmentFlag = true;
                }
                if(  matchObjProps.awb0ClosureRule.uiValues[ 0 ] !== '' && matchObjProps.awb0ClosureRule.uiValues[0] !== defaultClosureRule.dispValue ) {
                    structuresConfigDataList.expansionRule = {
                        dispValue: matchObjProps.awb0ClosureRule.uiValues[ 0 ],
                        splitter: true,
                        labelPosition: 'NO_PROPERTY_LABEL'
                    };
                }
                if( matchObjProps.awb0EffectivityGroups.dbValues.length > 0 ) {
                    contestUidGroupUidMAp[structure.pci.uid] = pciObj[0].props.awb0EffectivityGroups.dbValues;
                    groupUidList.push( ... pciObj[0].props.awb0EffectivityGroups.dbValues );
                }
            }

            structuresConfigData.push( structuresConfigDataList );
        }
    }
    // to collect group effectivity data if exist
    if( groupUidList.length > 0 ) {
        return getGrpUidUnitEndItemMap( groupUidList ).then( ( grpUidUnitEndItemMap )=>{
            for( const  key  of Object.keys( grpUidUnitEndItemMap ) ) {
                const grpEffectivity = grpUidUnitEndItemMap[key];
                let grpEffectivityList = [];
                for( const configData of structuresConfigData ) {
                    let grpEffUids =  contestUidGroupUidMAp[configData.pciUid];
                    if( grpEffUids !== undefined && grpEffUids.length > 0 ) {
                        let tooltip = [];
                        for( const grpUid of grpEffUids ) {
                            let object_string = cdm.getObjects( [ grpUid ] )[0].props.object_name.uiValues[0];
                            tooltip.push( object_string, ... grpEffectivity[grpUid] );
                            grpEffectivityList.push( {
                                dispValue:object_string,
                                isNull: 'false',
                                tooltip:{ title:resource.groupEffectivity, message: tooltip }
                            } );

                            tooltip = [];
                        }
                        configData.groupEffectivity = grpEffectivityList;
                        grpEffectivityList = [];
                    }
                }
            }
            return structuresConfigData;
        } );
    }
    return structuresConfigData;
}

/**
 *@param {Array} groupUidList group uid list
 */
function getGrpUidUnitEndItemMap( groupUidList ) {
    let grpUidUnitEndItemMap = {};
    return dmSvc.getProperties( groupUidList, [ 'Fnd0EffectivityList' ] ).then( ( res )=>{
        var grpEffectivityObjs = cdm.getObjects( groupUidList );
        let gropuData = grpEffectivityObjs.map( ( val )=> { return { dbvalue: val.props.Fnd0EffectivityList.dbValues, grpId: val.uid }; } );
        let filteredData = gropuData.map( ( val )=>val.dbvalue.map( ( v )=>{
            return{
                dbValue:v,
                grpId:val.grpId
            };
        }
        ) );
        let flatArray = [].concat( ...filteredData );
        let uids = flatArray.map( ( val )=>{
            return val.dbValue;
        } );
        if( uids.length > 0 ) {
            return dmSvc.getProperties( uids, [ 'unit_range_text', 'end_item' ] ).then( ( res )=>{
                var effectivities = cdm.getObjects( uids );
                return effectivities.map( ( val, i )=>{
                    if( !grpUidUnitEndItemMap.hasOwnProperty( flatArray[i].grpId ) ) {
                        grpUidUnitEndItemMap[flatArray[i].grpId] = [
                            resource.awb0EffUnitNoLabel + ':' + val.props.unit_range_text.dbValues[0],
                            resource.endItem + ':' + val.props.end_item.uiValues[0]
                        ];
                    } else{
                        grpUidUnitEndItemMap[flatArray[i].grpId].push(
                            resource.awb0EffUnitNoLabel + ':' + val.props.unit_range_text.dbValues[0],
                            resource.endItem + ':' + val.props.end_item.uiValues[0]
                        );
                    }
                    return grpUidUnitEndItemMap;
                } );
            } );
        }
        return grpUidUnitEndItemMap;
    } );
}
/**

 *@return {Array} workPackageContentTypes from the preference
 */
function getworkPackageContentTypesFromPref( ) {
    let workPackageContentTypes = [];
    let preferenceValues = appCtxSvc.getCtx( 'preferences.EP_WorkPackageContentType' );
    preferenceValues.forEach( element => {
        const structureName = element.indexOf( ':' ) > -1 ? element.split( ':' )[ 0 ] : element;
        workPackageContentTypes.push( structureName );
    } );
    return workPackageContentTypes;
}
export default {
    getStructuresConfigData
};
