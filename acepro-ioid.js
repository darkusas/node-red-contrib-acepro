/**
 * Copyright ACEPRO-NET by Darius Aleškaitis @ MB ALDARNA (2019 04 02)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED)
{
    //Main node
    function aceproIOID(config)
    {
        RED.nodes.createNode(this, config);
        var node = this;
        var network = RED.nodes.getNode(config.network);
          
       
        // tikrinam ar sukonfigūruotas networkas
        if(network == null) {node.error("[Critical] - ACEPRO network is not set"); return;}
        
        // nustatom pirminį statusą
        node.status({fill:"yellow",shape:"ring",text:"Initializing ..."});
        
        // pagrindinis CallBack'as ateinantis iš aceBUS magistralės
        var nCallBack = function(stateMsg, dataMsg){
         
            // jeigu atėjo nauji duomenys
             if(dataMsg !== null){ 
                 // persiunčiam duomenis į sekantį node'ą
                 node.send(dataMsg);
             }
             // jeigu atėjo statuso pasikeitimas
              if(stateMsg !== null){ 
                 // nustatom naują statusą
                 node.status(stateMsg);
             }        
         
        };
        
        
        
        // registruojam į bendrą networką
        network.RegisterIOID(config, nCallBack);
        
      
        // kai NODE yra uždaroma arba restartuojama, reikia išsiregistruoti iš sąrašo
        this.on("close", function() {
            network.UnRegisterIOID(config, nCallBack);
        });
    
      
        //Atėjo paketas iš kito node elemento, siunčiam į network managerį
        this.on("input", function(msg) {
            
         // node.status({fill:"yellow",shape:"dot",text:"Writing..."});
          
          network.send(config, msg, function(success, msg) {
              if(success==true) {
                 // node.status({fill:"orange",shape:"dot",text:"Done!"});
  
 
              }
              else {
                  node.status(msg.payload);
                  node.error("Failed with error: '" + msg.payload.text +"'");
              }
          });            
            
        });
      
      
      
      
    
    }
    
    
    
    // registruojam Node-RED sistemoje
    RED.nodes.registerType("aceproIOID in", aceproIOID);
    RED.nodes.registerType("aceproIOID out", aceproIOID);
}