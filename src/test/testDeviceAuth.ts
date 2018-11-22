import { EntityCredentials } from "../persist/entities/EntityCredentials";
import { Environment } from "../config/env";
import { development } from "../config/development";
Environment.config = development;
function Logar() {
    // test Login
    EntityCredentials.Instance.Login(``, '', (err, rs) => {
        if (err) {
            console.log(err);
        } else {
            if (rs) {
                console.log('Autenticado');
            } else {
                console.log('Nao autenticado');
            }
        }
    });
}

Logar();
