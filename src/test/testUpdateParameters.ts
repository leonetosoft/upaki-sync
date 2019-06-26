import { Database } from "../persist/Database";
import { EntityParameter } from "../persist/entities/EntityParameter";
import { Environment } from "../config/env";
import { development } from "../config/development";
import { UpakiParameters } from "../ipc/Parameters";

Environment.config = development;

Database.Instance.setMaster();

/*EntityParameter.Instance.UpdateParameters({'LEO':4 , 'TESTE' : 5});

EntityParameter.Instance.UpdateParameters({'LEO':4 , 'TESTE' : 5});*/

EntityParameter.Instance.UpdateParameters<UpakiParameters>({TESTE_PARAMETER: 'd', TESTE_PARAMETER_2: 'd'});

EntityParameter.Instance.GetParams<UpakiParameters>(['TESTE_PARAMETER', 'TESTE_PARAMETER_2']).then(rs => {
    console.log(rs.TESTE_PARAMETER);
}).catch(err => {
    console.log(err);
});