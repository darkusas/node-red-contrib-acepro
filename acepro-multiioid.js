/**
 * Copyright ACEPRO-NET by Darius Aleškaitis @ MB ALDARNA (2019 05 20)
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
    function aceproMultiIOID(config)
    {
        RED.nodes.createNode(this, config);
        var node = this;
        var network = RED.nodes.getNode(config.network);
          
       
        // tikrinam ar sukonfigūruotas networkas
        if(network == null) {node.error("[Critical] - ACEPRO network is not set"); return;}
            
        var grupe = [];
        
        
        // ----- 2019 05 27 --------------------
        
        
        var Last_stateMsg = null;
        var Last_dataMsg = null;
        
        const MinPeriod = 2000;      // [ms] - minimalus periodas kada duomenys perduodami toliau
        var   Timeris = null;       // taimeris skirtas riboti
        
        // visus gaunamus paketus dedam į eilę apdorojimui
        var msgStQue = [];        
        var msgQue = [];

        
        var Apdoroti = function()
        {
            let dataMsg = Last_dataMsg;            
            let stateMsg = Last_stateMsg;

            // jeigu buvo užstatytas taimeris tuomet ištrinam 
            if(Timeris !== null){
                clearTimeout(Timeris);
                Timeris = null;                
            }


            // jeigu nėra aktualios informacijos išeinam
            if((dataMsg == null)&&(stateMsg == null)) return null;
            
                // atliekam skaičiaivmus ir atvaizdavimus   
                let curTopic = "";
                
                // jeigu atėjo nauji duomenys
                 if(dataMsg !== null){ 
                     // persiunčiam duomenis į sekantį node'ą
                     
                 
                 // įrašom dabar gautas reikšmes, ir sukuriam grupes jeigu to settingai reikalauja
                 if(dataMsg[0] !== null){
                    curTopic = dataMsg[0].topic;  
                    
                    
                    if( grupe[curTopic] === undefined){
                        console.log("multiIOID ERR1. dataMsg[0]:");
                        console.log(dataMsg[0]);
                        return null;
                    } 
                    
                    grupe[curTopic].St = dataMsg[0].IOIDstate;
                    grupe[curTopic].LastVAL = dataMsg[0].payload;
                    
                      if(SendAll){
                         var GrSt = 0;
                         var td = {};
                         var p3 = {};
                         
                         var tval = 0;
                         var tst = -1;
                         
                         var start = true;
                         var nKey = "";
                         
                         var minVal = 0;
                         var minName = "";
                         
                         var maxVal = 0;
                         var maxName = "";
                         
                         var avrVal = 0;
                         var avrCount = 0;
                         
                         for(var raktas in grupe){
                             
                            tval = grupe[raktas].LastVAL;
                            tst = grupe[raktas].St;
                            nKey = grupe[raktas].newKey;
                             
                            td[nKey] = tval;
                            p3[grupe[raktas].IOID]  = tval;
                            
                            if(tst !== 0 ) GrSt = tst;
                            
                            if(tst===0){
                                
                                if(start){
                                    minVal = tval;
                                    minName = nKey;
                                    maxVal = tval;
                                    maxName = nKey;
                                    avrVal = tval;
                                    avrCount = 1;
                                    start = false;
                                }else{
                                    
                                    if(tval<minVal){
                                        minVal = tval;
                                        minName = nKey;
                                    }
                                    
                                    if(tval>maxVal){
                                        maxVal = tval;
                                        maxName = nKey;
                                    }
                                                                        
                                    avrVal += tval;
                                    avrCount++;
                                }                           

                            }
                            
                         }
                         
                        avrVal /= avrCount;
                        td.GrSt = GrSt;
                        td.stats = {
                            minVal  : minVal,
                            minName : minName,
                            maxVal  : maxVal,
                            maxName : maxName,
                            avrVal  : avrVal
                        };  
                        

                        dataMsg[0].payload2 = td;
                        dataMsg[0].payload3 = p3;
                        
                     }   
                     
                     dataMsg[0].newKey = grupe[curTopic].newKey;
                 }
                
                 if(dataMsg[1] !== null){
                    curTopic = dataMsg[1].topic;
                    
                    if( grupe[curTopic] === undefined){
                        console.log("multiIOID ERR1. dataMsg[1]:");
                        console.log(dataMsg[1]);
                        return null;
                    } 
                    
                    grupe[curTopic].St = dataMsg[1].IOIDstate;
                   // grupe[curTopic].LastVAL = dataMsg[1].Value;
                    
                      if(SendAll){
                         let GrSt = 0;
                         let td = {};
                         
                         for(var raktas in grupe){
                            if(grupe[raktas].St !== 0 ) GrSt = grupe[raktas].St;
                         }
                        td.GrSt = GrSt;
                        dataMsg[1].payload2 = td;
                     }                       
                    
                    dataMsg[1].newKey = grupe[curTopic].newKey;
                 }
                
                 
                 // siunčiam į kitą node'ą
                 node.send(dataMsg);
             }
             // jeigu atėjo statuso pasikeitimas
              if(stateMsg !== null){ 
                 // nustatom naują statusą
                 node.status(stateMsg);
             }                      
            
        }      
        
        //--------------------------------------
        
        
    
        var SendAll = (config.SendAll === "true") || false;
    
        let dpar = JSON.parse(config.config);
        for(var i in dpar){
            let host = dpar[i][0];
            let IOID = dpar[i][1];
            let newKey = dpar[i][2] || "";
            newKey = newKey.replace(/ /g,"_");
            
            // paruošiam topic'ą
            let topic = host + "_" + IOID;
            
            // pasiruošiam struktūrą
             grupe[topic] = {           
                      host      : host,     // host įrenginys
                      IOID      : IOID,     // IOID
                      newKey    : newKey,   // raktas kuris bus priskirtas išvedime
                      St        : -1,       // Paskutinis žinomas statusas
                      LastVAL   : 0.0       // Paskutinė žinoma reikmė
             };
            
        }  

        // laikinas debuinimui
      //  console.log(grupe);
        
       
        // nustatom pirminį statusą
        node.status({fill:"yellow",shape:"ring",text:"Initializing ..."});
        
        

        
        // pagrindinis CallBack'as ateinantis iš aceBUS magistralės
        var nCallBack = function(stateMsg, dataMsg){
         

            Last_stateMsg = stateMsg;
            Last_dataMsg = dataMsg;

            
            if(Timeris==null) {
                Apdoroti();
                Timeris = setTimeout(Apdoroti, MinPeriod);
            }else{
                
            
                // atliekam skaičiaivmus ir atvaizdavimus   
                let curTopic = "";
                
                // jeigu atėjo nauji duomenys
                 if(dataMsg !== null){
                     // persiunčiam duomenis į sekantį node'ą
                     
                     
                     // įrašom dabar gautas reikšmes, ir sukuriam grupes jeigu to settingai reikalauja
                     if(dataMsg[0] !== null){
                        curTopic = dataMsg[0].topic;  
                        
                        if( grupe[curTopic] === undefined){
                            console.log("multiIOID ERR1. dataMsg[0]:");
                            console.log(dataMsg[0]);
                            return null;
                        } 
                        
                        grupe[curTopic].St = dataMsg[0].IOIDstate;
                        grupe[curTopic].LastVAL = dataMsg[0].payload;
                        
                     }
                    
                     if(dataMsg[1] !== null){
                        curTopic = dataMsg[1].topic;
                        
                        if( grupe[curTopic] === undefined){
                            console.log("multiIOID ERR1. dataMsg[1]:");
                            console.log(dataMsg[1]);
                            return null;
                        } 
                        
                        grupe[curTopic].St = dataMsg[1].IOIDstate;
                     }
                
                 }
            
            }
            
            
        };
    
        
        // visus IOID registruojam į bendrą networką
        for(var raktas in grupe){
            network.RegisterIOID(grupe[raktas], nCallBack); 
        }
      
      
        // kai NODE yra uždaroma arba restartuojama, reikia išsiregistruoti iš sąrašo, išregistruojam visus grupei priklausančius IOID
        this.on("close", function() {
            for(var raktas in grupe){
                network.UnRegisterIOID(grupe[raktas], nCallBack); 
            }
        });
    
      
        //Atėjo paketas iš kito node elemento, siunčiam į network managerį, visiems grupės IOIDs
        this.on("input", function(msg) {
            for(var raktas in grupe){
                  network.send(grupe[raktas], msg, function(success, msg) {
                      if(success!==true) {
                          node.status(msg.payload);
                          node.error("Failed with error: '" + msg.payload.text +"'");
                      }
                  });                
            }         
        });
      

    
    }
    
    
    
    // registruojam Node-RED sistemoje
    RED.nodes.registerType("aceproMultiIOID in", aceproMultiIOID);
    RED.nodes.registerType("aceproMultiIOID out", aceproMultiIOID);
}