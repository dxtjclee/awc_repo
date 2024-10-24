// Copyright (c) 2022 Siemens Digital Industries Software

/**
 * @module js/qa0SubFindingGuidelineService
 */

 import app from 'app';

 var exports = {};

 /**
  * This method is used to get the LOV values for the versioning panel.
  * @param {Object} response the response of the getLov soa
  * @param {ctx} context redux store which holds common data
  * @returns {Object} value the LOV value
  */
export let getLOVList = function( response, ctx ) {    
    var selected;

    if ( ctx && ctx.selected.type === 'Qa0QualityAudit' ) {
        selected = ctx.selected;
    }

    if ( ctx && !selected && ctx.pselected.type === 'Qa0QualityAudit' ) {
        selected = ctx.pselected;
    }

    var findingGuidelines = response.lovValues;
    if( selected && selected.props.qa0AuditNorms ) {
        var auditNorms = selected.props.qa0AuditNorms.displayValues;
        if( auditNorms.length > 0 ) { // Filter the finding guideline only when there is audit norms present.
            findingGuidelines = response.lovValues.filter( ( values ) =>{
                var findingGuidelineNorms = values.propDisplayValues.qa0AuditNorms[0].split( ',' );
                if( findingGuidelineNorms.length > 0 && findingGuidelineNorms[0].length > 0 ) { // check for the emptry string in the array, when it has no audit norms assigned
                   return findingGuidelineNorms.find( norms => {
                        return auditNorms.includes( norms );
                    } );
                }
             } );
         }
    }

    var lovList = findingGuidelines.map( function( obj ) {
        return {
            propDisplayValue: obj.propDisplayValues.object_name[ 0 ],
            propDisplayDescription: obj.propDisplayValues.object_name[ 0 ] + ' ' + obj.propDisplayValues.object_desc[ 0 ],
            propInternalValue: obj.propInternalValues.object_name[ 0 ]
        };
    } );
     lovList.unshift( {
         propDisplayValue: '',
         propDisplayDescription: '',
         propInternalValue: ''
     } );

     return lovList;
 };

 /**
  * set selected finding in a property provided by parent component
  * @param {object} subPanelContext context object provided by parent component
  * @param {DeclViewModel} data local declarative view model object
  */
 export let setFindingGuideline = function( subPanelContext, data ) {
    if(subPanelContext.qa0FindingGuideline) {
        subPanelContext.qa0FindingGuideline.dbValue = data.findingGuideline.dbValue;
    }
 };

 export default exports = {
     getLOVList,
     setFindingGuideline
 };

 /**
  * @member qa0SubFindingGuidelineService
  * @memberof NgServices
  */
 app.factory( 'qa0SubFindingGuidelineService', () => exports );


