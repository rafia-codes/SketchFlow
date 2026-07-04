'use client'

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type AuthContextType = {
    user: boolean;
    loading: boolean;
    theme: "light" | "dark"
    login: (token:string) => void;
    logout: () => void
}
const UserContext = createContext<AuthContextType | null>(null);

export function AuthProvider({children}:{children:ReactNode}){
    const [user,setUser] = useState<boolean>(false);
    const [loading,setLoading] = useState<boolean>(true);
    const [theme,setTheme] = useState<"light"|"dark">("dark");

    useEffect(()=>{
        const token = localStorage.getItem('token');
        if(token){
            setUser(true);
            setLoading(false);
        }
    },[]);

    const login = (token:string) => {
        localStorage.setItem('token',token);
        setUser(true);
        setLoading(false);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(false);
        setLoading(true);
    };

    return <UserContext.Provider value={{user,loading,theme,login,logout}}>
        {children}
    </UserContext.Provider>
}

export function useAuth(){
    const context = useContext(UserContext);

    if(!context)
        throw new Error("useAuth must be used within an AuthProvider");

    return context;
}