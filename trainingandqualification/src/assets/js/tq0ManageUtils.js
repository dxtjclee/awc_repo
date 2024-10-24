// Copyright (c) 2022 Siemens

/**
 * This file is used as utility file for Training and Qualification module
 *
 * @module js/tq0ManageUtils
 */

 import _ from 'lodash';

 import _localeSvc from 'js/localeService';
 import addObjectUtils from 'js/addObjectUtils';



 var exports = {};

 
 let getCreateObjectInfoProps = function( data, strProps) {
     if ( data.objCreateInfo && data.objCreateInfo.props ) {
         data.objCreateInfo.props.forEach( ( vmProp ) => {

             if ( vmProp.type === 'STRING' && vmProp.dbValue !== null ) {
                 strProps[vmProp.propertyName] = vmProp.dbValue;
             }

         } );
     }
 };
 
 export let getCreateObjectInfo = function( data, editHandler ) {
     if ( !data.objCreateInfo ) {
        data.selectedType =data.addPanelState.creationType.props.type_name.dbValues[0];
         data.objCreateInfo = addObjectUtils.getObjCreateInfo( data.selectedType, editHandler );
     }
 

     var strProps = {};

 
     getCreateObjectInfoProps( data,  strProps );
 

     var inputData = {
         boName: data.selectedType,
         stringProps: strProps
     };
 
     let input = [];
 
     input.push( {
         clientId: '',
         data: inputData
     } );
     return input;
 };
 
 export default exports = {
     getCreateObjectInfo
     
 };
 