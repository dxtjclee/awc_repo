// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Digital Industries Software
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**

 * @module propRenderTemplates/qa0PropRenderHelper
 */

import * as app from 'app';
import AwPromiseService from 'js/awPromiseService';
import awTableTreeSvc from 'js/published/splmTablePublishedService';
import cdm from 'soa/kernel/clientDataModel';
import htmlUtil from 'js/htmlUtils';
import navigationTokenService from 'js/navigationTokenService';
import utils from 'js/qa0AuditUtils';
import _ from 'lodash';
 
var exports = {};

var populateHrefContentPerPropValue = function( objectElement, scope, uidToBeEvaluated, vmo ) {
    var deferred = AwPromiseService.instance.defer();
    if( objectElement && scope && uidToBeEvaluated ) {
        navigationTokenService.getNavigationContent( scope, uidToBeEvaluated, vmo ).then( function( urlDetails ) {
            var hrefDetails = urlDetails;
            if( hrefDetails ) {
                deferred.resolve( { objectElement: objectElement, url: hrefDetails } );
            }
        } );
    }
    return deferred.promise;
};

var addAttributeToDOMElement = function( elem, attribute, attrValue ) {
    var att = document.createAttribute( attribute );
    att.value = attrValue;
    elem.setAttributeNode( att );
    return elem;
};

var addHrefToAnchorLink = function( objectElement, scope, uidToBeEvaluated, vmo ) {
    objectElement.addEventListener( 'mouseenter', function() {
        populateHrefContentPerPropValue( objectElement, scope, uidToBeEvaluated, vmo ).then( function( response ) {
            if( !_.isUndefined( response ) ) {
                objectElement = addAttributeToDOMElement( response.objectElement, 'href', response.url.urlContent );
                objectElement = addAttributeToDOMElement( objectElement, 'target', response.url.target );
            }
        } );
    } );
    return objectElement;
};

var createObjectCellElement = function( prop ) {    
    var scope = {};       
    var fragment = document.createDocumentFragment();
    var value = prop.uiValue;
    var liForObjectLinks = htmlUtil.createElement( 'li', awTableTreeSvc.CLASS_WIDGET_TABLE_CELL_TEXT );    
    if( value ) {
        let objectElement = htmlUtil.createElement( 'a' );
        objectElement.tabIndex = -1;       
        // associating every prop with href
        var uidToBeEvaluated = '';
        uidToBeEvaluated = prop.dbValue;
        addHrefToAnchorLink( objectElement, scope, uidToBeEvaluated ); 
        objectElement.innerHTML = value;
        liForObjectLinks.appendChild( objectElement );
    }
    fragment.appendChild( liForObjectLinks );          
    return fragment;
};

export let showIndicatorOnMajorFindings = function( vmo, containerElem, field ) {       
    var prop = vmo.props[ field ];
    if( _.isNull(prop.dbValue) ) {                
        var findingGuidelineProp = vmo.props[ 'REF(items_tag,C2Issue).qa0FindingGuideline' ];
        
        if( !(_.isNull(findingGuidelineProp.dbValue)) )
        {
            var findingGuidelineObj = cdm.getObject( findingGuidelineProp.dbValue );
            if(findingGuidelineObj && findingGuidelineObj.props &&
                findingGuidelineObj.props.qa0ActionRequired && findingGuidelineObj.props.qa0ActionRequired.dbValues[0] === 'Required')
            {
                let imageElement = document.createElement( 'img' );
                imageElement.className = 'aw-visual-indicator';
                let imagePath = app.getBaseUrlPath() + '/image/';
                let localizedText = utils.getLocalizedMessage( 'qualityauditMessages','qa0ActionRequired');
                imageElement.title = localizedText;
                imagePath += 'indicatorWarning16.svg';
                imageElement.src = imagePath;
                imageElement.alt = localizedText;
                containerElem.appendChild( imageElement );
            }        
        }
    }
    else
    {
        containerElem.classList.remove(awTableTreeSvc.CLASS_TABLE_CELL_TOP);  
        containerElem.style.paddingLeft = "unset";
        var ulForObjectLinks = htmlUtil.createElement( 'ul', awTableTreeSvc.CLASS_TABLE_CELL_TOP );
        ulForObjectLinks.title = prop.uiValue;
        var childElem = createObjectCellElement(prop);
        ulForObjectLinks.appendChild( childElem );
        containerElem.appendChild( ulForObjectLinks );
    }
};

export default exports = {
    showIndicatorOnMajorFindings
};