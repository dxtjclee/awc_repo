

import AwLovEdit from 'viewmodel/AwLovEditViewModel';
import _ from 'lodash';

export const att1InlinePropertyRenderFn = ( props ) => {
    const {  viewModel, ...prop } = props;
    let vmprop = prop.__vmprop__();
    let fielddata = { ...prop.fielddata };
    fielddata.hasLov = true;
    fielddata.emptyLOVEntry = false;
    if( prop.name === 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0AttrDefRev,Att0AttributeDefRevision).att0AttrType' ) {
        fielddata.dataProvider = viewModel.dataProviders.dataTypeListProvider;
    }
    if( prop.name === 'att1AttrInOut' ) {
        fielddata.dataProvider = viewModel.dataProviders.usageListProvider;
    }
    if( prop.name === 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).att0Uom' ) {
        fielddata.dataProvider = viewModel.dataProviders.uomListProvider;
    }
    if( prop.name === 'REF(att1SourceAttribute,Att0MeasurableAttributeDbl).REF(att0AttrDefRev,Att0AttributeDefRevision).object_name' ) {
        fielddata.dataProvider = viewModel.dataProviders.paramDefListProvider;
    }
    const passedProps = { ...prop,  fielddata };
    if ( vmprop.filterString !== undefined ) {
        fielddata.dataProvider.setFilterString( vmprop.filterString );
    }

    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

