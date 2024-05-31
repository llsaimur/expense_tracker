import React from 'react'
import {Route, Switch} from 'react-router-dom'
import Home from './core/Home'
import Users from './user/Users.js'
import Signup from './user/Signup.js'
import Signin from './auth/Signin.js'
import Profile from './user/Profile.js'
import EditProfile from './user/EditProfile'
import PrivateRoute from './auth/PrivateRoute'
import Menu from './core/Menu.js'
import NewExpense from './expense/NewExpense.js'
import Expenses from './expense/Expenses'
import Reports from './report/Reports'

const MainRouter = () => {
 return ( <div>
    <Menu></Menu>
 <Switch>
 <Route exact path="/" component={Home}/>
 <Route path="/users" component={Users}/>
 <Route path="/signup" component={Signup}/>
 <Route path="/signin" component={Signin}/>
 <PrivateRoute path="/user/edit/:userId" component={EditProfile}/>
 <Route path="/user/:userId" component={Profile}/>

 <PrivateRoute path="/expenses/all" component={Expenses}/>
 <PrivateRoute path="/expenses/new" component={NewExpense}/>
 <PrivateRoute path="/expenses/reports" component={Reports}/>
 </Switch>
 </div>
 )
}
export default MainRouter